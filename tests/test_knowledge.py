"""Knowledge ingestion tests; no real documents or external API calls."""
import io
import os
import tempfile
import unittest
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

import test_auth as auth_fixture
from docx import Document
from api.knowledge import knowledge
from api.knowledge_embeddings import generate_embeddings, validate_embeddings, EmbeddingServiceError
from api.knowledge_text import extract_text, split_text
from api.models import db, KnowledgeDocument, KnowledgeChunk, CompanyMembership, MembershipRole, utc_now


class KnowledgeTest(unittest.TestCase):
    def setUp(self):
        self.fixture = auth_fixture.AuthenticationTest()
        self.fixture.setUp()
        self.temp = tempfile.TemporaryDirectory()
        self.fixture.app.config['KNOWLEDGE_STORAGE_DIR'] = self.temp.name
        self.fixture.app.register_blueprint(knowledge, url_prefix='/api')
        self.client = self.fixture.client
        self.headers = self.fixture.headers() | {'X-Company-ID': str(self.fixture.company_id)}
        self.env = patch.dict(os.environ, KNOWLEDGE_EMBEDDINGS_MODEL='test-model')
        self.env.start()

    def tearDown(self):
        self.env.stop()
        self.temp.cleanup()
        self.fixture.tearDown()

    def upload(self, content=b'Useful company information.', name='guide.txt'):
        return self.client.post('/api/knowledge/documents', headers=self.headers,
                                data={'file': (io.BytesIO(content), name), 'title': 'Guide'})

    def process(self, document_id, error=None):
        def vectors(texts):
            if error:
                raise error
            return [[0.5, 0.2] for _ in texts]
        with patch('api.knowledge_embeddings.request_embeddings', side_effect=vectors):
            return self.client.post(f'/api/knowledge/documents/{document_id}/process', headers=self.headers)

    def test_complete_flow_and_reprocessing_replaces_chunks(self):
        result = self.upload(b'Company services. ' * 200)
        self.assertEqual(result.status_code, 201)
        did = result.json['document']['id']
        self.assertEqual(self.process(did).status_code, 200)
        chunks = db.session.scalars(db.select(KnowledgeChunk)).all()
        self.assertGreater(len(chunks), 1)
        count = len(chunks)
        self.assertTrue(all(c.document_id == did and c.embedding == [0.5, 0.2] and c.embedding_model == 'test-model' for c in chunks))
        self.assertEqual(self.process(did).status_code, 200)
        self.assertEqual(len(db.session.scalars(db.select(KnowledgeChunk)).all()), count)
        self.assertEqual(self.client.get(f'/api/knowledge/documents/{did}/chunks', headers=self.headers).json['total'], count)
        doc = db.session.get(KnowledgeDocument, did)
        path = Path(self.temp.name) / doc.storage_key
        self.assertTrue(path.is_file())
        self.assertEqual(self.client.delete(f'/api/knowledge/documents/{did}', headers=self.headers).status_code, 200)
        self.assertFalse(path.exists())
        self.assertEqual(db.session.scalars(db.select(KnowledgeChunk)).all(), [])

    def test_failed_reprocess_preserves_previous_vectors_and_retry_recovers(self):
        did = self.upload().json['document']['id']
        self.process(did)
        result = self.process(did, EmbeddingServiceError('secret-provider-response'))
        self.assertEqual(result.status_code, 422)
        self.assertEqual(result.json['document']['ingestion_status'], 'failed')
        self.assertNotIn('secret-provider-response', str(result.json))
        self.assertEqual(result.json['document']['chunk_count'], 1)
        self.assertEqual(self.process(did).json['document']['ingestion_status'], 'ready')

    def test_other_company_cannot_read_process_or_delete(self):
        did = self.upload().json['document']['id']
        doc = db.session.get(KnowledgeDocument, did)
        doc.company_id = self.fixture.other_id
        db.session.commit()
        self.assertEqual(self.client.get('/api/knowledge/documents', headers=self.headers).json['total'], 0)
        for method, suffix in [('get', ''), ('get', '/chunks'), ('post', '/process'), ('delete', '')]:
            self.assertEqual(getattr(self.client, method)(f'/api/knowledge/documents/{did}{suffix}', headers=self.headers).status_code, 404)
        self.assertEqual(self.client.get('/api/knowledge/documents').status_code, 401)

    def test_viewer_cannot_mutate(self):
        did = self.upload().json['document']['id']
        member = db.session.scalar(db.select(CompanyMembership).where(CompanyMembership.company_id == self.fixture.company_id))
        member.role = MembershipRole.TECHNICIAN
        db.session.commit()
        self.assertEqual(self.upload().status_code, 403)
        self.assertEqual(self.client.get('/api/knowledge/documents', headers=self.headers).status_code, 200)
        for method, suffix in [('post', '/process'), ('delete', '')]:
            self.assertEqual(getattr(self.client, method)(f'/api/knowledge/documents/{did}{suffix}', headers=self.headers).status_code, 403)

    def test_busy_claim_and_stale_recovery(self):
        did = self.upload().json['document']['id']
        doc = db.session.get(KnowledgeDocument, did)
        doc.ingestion_status = 'processing'
        doc.processing_token = 'old-worker'
        db.session.commit()
        self.assertEqual(self.process(did).status_code, 409)
        self.assertEqual(self.client.delete(f'/api/knowledge/documents/{did}', headers=self.headers).status_code, 409)
        doc.updated_at = utc_now() - timedelta(minutes=31)
        db.session.commit()
        self.assertEqual(self.process(did).status_code, 200)

    def test_invalid_uploads_and_empty_pdf_fail_safely(self):
        for content, name in [(b'', 'empty.txt'), (b'wrong', 'bad.pdf'), (b'wrong', 'bad.docx'), (b'hello', 'bad.exe'), (b'\x00', 'binary.txt')]:
            self.assertEqual(self.upload(content, name).status_code, 400)
        from pypdf import PdfWriter
        output = io.BytesIO()
        writer = PdfWriter(); writer.add_blank_page(width=100, height=100); writer.write(output)
        did = self.upload(output.getvalue(), 'blank.pdf').json['document']['id']
        self.assertEqual(self.process(did).json['document']['ingestion_status'], 'failed')
        self.assertEqual(self.client.get('/api/knowledge/documents?page=0', headers=self.headers).status_code, 400)

    def test_docx_upload_extraction_and_path_isolation(self):
        output = io.BytesIO()
        docx = Document(); docx.add_paragraph('Company opening hours'); docx.save(output)
        did = self.upload(output.getvalue(), 'hours.docx').json['document']['id']
        self.assertEqual(self.process(did).status_code, 200)
        doc = db.session.get(KnowledgeDocument, did)
        doc.storage_key = '../outside.txt'
        db.session.commit()
        self.assertEqual(self.process(did).status_code, 422)
        self.assertEqual(self.client.delete(f'/api/knowledge/documents/{did}', headers=self.headers).status_code, 503)

    def test_pdf_text_is_extracted_and_stored(self):
        from pypdf import PdfWriter
        from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject
        writer = PdfWriter()
        page = writer.add_blank_page(width=300, height=300)
        font = DictionaryObject({NameObject('/Type'): NameObject('/Font'),
            NameObject('/Subtype'): NameObject('/Type1'), NameObject('/BaseFont'): NameObject('/Helvetica')})
        page[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'): DictionaryObject({NameObject('/F1'): font})})
        stream = DecodedStreamObject()
        stream.set_data(b'BT /F1 12 Tf 20 250 Td (Company PDF information) Tj ET')
        page[NameObject('/Contents')] = stream
        output = io.BytesIO(); writer.write(output)
        did = self.upload(output.getvalue(), 'guide.pdf').json['document']['id']
        self.assertEqual(self.process(did).status_code, 200)
        chunk = db.session.scalar(db.select(KnowledgeChunk).where(KnowledgeChunk.document_id == did))
        self.assertIn('Company PDF information', chunk.content)


class EmbeddingsUnitTest(unittest.TestCase):
    def test_batch_limits_and_order(self):
        texts = [str(i) + 'x' * 7990 for i in range(40)]
        calls = []
        def request(batch):
            calls.append(batch)
            return [[text] for text in batch]
        with patch('api.knowledge_embeddings.request_embeddings', side_effect=request):
            self.assertEqual(generate_embeddings(texts), [[text] for text in texts])
        self.assertTrue(all(len(batch) <= 32 and sum(map(len, batch)) <= 64000 for batch in calls))

    def test_response_validation(self):
        for vectors in [[[True, 1]], [[float('nan'), 1]], [[0, 0]], [[1]], []]:
            with self.assertRaises(EmbeddingServiceError):
                validate_embeddings({'model': 'test', 'dimensions': 2, 'embeddings': vectors}, 1, 'test', 2)

    def test_normalization_and_chunks(self):
        self.assertEqual(extract_text(b'  First\r\n\r\nSecond  ', '.txt'), 'First\n\nSecond')
        self.assertEqual(split_text('abcdef', 4, 1), ['abcd', 'def'])

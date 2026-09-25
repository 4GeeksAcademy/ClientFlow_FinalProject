from test_clients import ClientRelatedResourcesTest
from api.models import Client, db


class ClientListRegressionTest(ClientRelatedResourcesTest):
    def test_pagination_search_and_status(self):
        for index in range(25):
            db.session.add(Client(company_id=self.company.id,
                first_name=f"Regression{index}", is_active=index != 0))
        db.session.commit()
        headers = self.headers()
        first = self.client_http.get('/api/clients?per_page=20', headers=headers)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json['total'], 26)
        self.assertEqual(len(first.json['items']), 20)
        second = self.client_http.get('/api/clients?page=2', headers=headers)
        self.assertEqual(len(second.json['items']), 6)
        filtered = self.client_http.get('/api/clients?search=Regression0&status=inactive', headers=headers)
        self.assertEqual(filtered.json['total'], 1)
        self.assertFalse(filtered.json['items'][0]['is_active'])
        invalid = self.client_http.get('/api/clients?status=invalid', headers=headers)
        self.assertEqual(invalid.status_code, 400)

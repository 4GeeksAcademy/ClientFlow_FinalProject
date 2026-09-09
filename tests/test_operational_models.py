import unittest

from sqlalchemy import CheckConstraint

from src.api.models import db


class OperationalModelTest(unittest.TestCase):
    def test_operational_tables_are_registered(self):
        expected_tables = {
            "job_assignments",
            "job_stages",
            "job_materials",
            "next_actions",
            "activities",
            "attachments",
        }

        self.assertTrue(expected_tables.issubset(db.metadata.tables))

    def test_job_children_have_mandatory_parent_relationships(self):
        for table_name in ("job_assignments", "job_stages", "job_materials"):
            table = db.metadata.tables[table_name]
            job_id = table.c.job_id

            self.assertFalse(job_id.nullable)
            self.assertEqual(
                {foreign_key.target_fullname for foreign_key in job_id.foreign_keys},
                {"jobs.id"},
            )

    def test_tenant_owned_records_include_company_id(self):
        for table_name in ("next_actions", "activities", "attachments"):
            table = db.metadata.tables[table_name]
            company_id = table.c.company_id

            self.assertFalse(company_id.nullable)
            self.assertEqual(
                {
                    foreign_key.target_fullname
                    for foreign_key in company_id.foreign_keys
                },
                {"companies.id"},
            )

    def test_polymorphic_records_require_exactly_one_target(self):
        expected_constraints = {
            "next_actions": "ck_next_action_one_target",
            "activities": "ck_activity_one_target",
            "attachments": "ck_attachment_one_target",
        }

        for table_name, constraint_name in expected_constraints.items():
            constraints = db.metadata.tables[table_name].constraints
            check_names = {
                constraint.name
                for constraint in constraints
                if isinstance(constraint, CheckConstraint)
            }

            self.assertIn(constraint_name, check_names)


if __name__ == "__main__":
    unittest.main()

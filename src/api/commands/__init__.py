import click
from api.models import db, User, Plan
from flask.cli import with_appcontext

"""
In this file, you can add as many commands as you want using the @app.cli.command decorator
Flask commands are usefull to run cronjobs or tasks outside of the API but sill in integration 
with youy database, for example: Import the price of bitcoin every night as 12am
"""
def setup_commands(app):
    
    """ 
    This is an example command "insert-test-users" that you can run from the command line
    by typing: $ flask insert-test-users 5
    Note: 5 is the number of users to add
    """
    @app.cli.command("insert-test-users")
    @click.argument("count")
    def insert_test_users(count):
        print("Creating test users")
        for x in range(1, int(count) + 1):
            user = User()
            user.email = "test_user" + str(x) + "@test.com"
            user.password = "123456"
            user.is_active = True
            db.session.add(user)
            db.session.commit()
            print("User: ", user.email, " created.")

        print("All test users created")

    @app.cli.command("insert-test-data")
    def insert_test_data():
        pass


@click.command('seed')
@with_appcontext
def seed_data():
    """Seed initial plans."""
    if Plan.query.first() is not None:
        click.echo("Plans already seeded!")
        return
    
    plans = [
        Plan(
            code='free',
            name='Free',
            description='Free plan with basic features',
            price_eur=0,
            billing_interval='monthly',
            trial_days=7,
            limits={'leads': 100, 'conversations': 10},
            is_active=True
        ),
        Plan(
            code='starter',
            name='Starter',
            description='Starter plan for small businesses',
            price_eur=29.99,
            billing_interval='monthly',
            trial_days=14,
            limits={'leads': 500, 'conversations': 50},
            is_active=True
        ),
        Plan(
            code='professional',
            name='Professional',
            description='Professional plan for growing teams',
            price_eur=99.99,
            billing_interval='monthly',
            trial_days=30,
            limits={'leads': 2000, 'conversations': 200},
            is_active=True
        ),
        Plan(
            code='enterprise',
            name='Enterprise',
            description='Enterprise plan with unlimited features',
            price_eur=299.99,
            billing_interval='monthly',
            trial_days=30,
            limits={'leads': None, 'conversations': None},
            is_active=True
        ),
    ]
    
    db.session.add_all(plans)
    db.session.commit()
    click.echo("Seed data created successfully!")
def register_seed(app):
    app.cli.add_command(seed_data)
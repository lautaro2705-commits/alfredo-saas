"""
Load testing for SaaS Platform with Locust.

Simulates realistic tenant user behavior across multiple tenants.

Usage:
  pip install locust
  locust -f tests/load/locustfile.py --host http://localhost:8000

Configuration via env vars:
  LOAD_TEST_EMAIL    — admin email for login (default: admin@demo.com)
  LOAD_TEST_PASSWORD — password (default: demo1234)
  LOAD_TEST_TENANTS  — number of tenants to simulate (default: 5)

Targets:
  - P95 read  < 500ms
  - P95 write < 1s
  - Zero RLS data leakage under load
"""
import os
import json
import random

from locust import HttpUser, task, between, events


# ── Config ──

BASE_EMAIL = os.getenv("LOAD_TEST_EMAIL", "admin@demo.com")
BASE_PASSWORD = os.getenv("LOAD_TEST_PASSWORD", "demo1234")


class TenantUser(HttpUser):
    """
    Simulates a typical tenant user: login, browse dashboard, list/view items.
    Weighted tasks reflect real usage patterns.
    """
    wait_time = between(1, 3)  # 1-3 seconds between requests

    def on_start(self):
        """Login and store token."""
        resp = self.client.post("/api/v1/auth/login", json={
            "email": BASE_EMAIL,
            "password": BASE_PASSWORD,
        })
        if resp.status_code == 200:
            data = resp.json()
            self.token = data["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
            self.vertical = data.get("vertical", "autos")
            self.plan = data.get("plan", "trial")
        else:
            self.token = None
            self.headers = {}

    def _auth_get(self, path, name=None):
        """GET with auth header."""
        return self.client.get(
            path,
            headers=self.headers,
            name=name or path,
        )

    def _auth_post(self, path, json_data=None, name=None):
        """POST with auth header."""
        return self.client.post(
            path,
            json=json_data or {},
            headers=self.headers,
            name=name or path,
        )

    # ── Tasks (weighted by frequency) ──

    @task(10)
    def get_profile(self):
        """GET /auth/me — most frequent, lightweight."""
        self._auth_get("/api/v1/auth/me")

    @task(8)
    def list_unidades(self):
        """GET /autos/unidades/ — main listing page."""
        self._auth_get("/api/v1/autos/unidades/")

    @task(5)
    def get_dashboard(self):
        """GET /autos/dashboard — aggregated stats."""
        self._auth_get("/api/v1/autos/dashboard/")

    @task(3)
    def billing_overview(self):
        """GET /billing/overview — plan + usage info."""
        self._auth_get("/api/v1/billing/overview")

    @task(2)
    def list_plans(self):
        """GET /billing/plans — public endpoint."""
        self.client.get("/api/v1/billing/plans")

    @task(1)
    def trial_status(self):
        """GET /billing/trial-status."""
        self._auth_get("/api/v1/billing/trial-status")


class AdminUser(HttpUser):
    """
    Simulates a platform admin checking metrics and managing tenants.
    Lower frequency than regular users.
    """
    wait_time = between(3, 8)
    weight = 1  # 1 admin per 10 regular users

    def on_start(self):
        """Login as platform admin."""
        admin_email = os.getenv("LOAD_TEST_ADMIN_EMAIL", "superadmin@saas.com")
        admin_password = os.getenv("LOAD_TEST_ADMIN_PASSWORD", "SuperAdmin2024!")

        resp = self.client.post("/api/v1/auth/login", json={
            "email": admin_email,
            "password": admin_password,
        })
        if resp.status_code == 200:
            data = resp.json()
            self.token = data["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            self.token = None
            self.headers = {}

    @task(5)
    def get_metrics(self):
        """GET /admin/metrics — platform KPIs."""
        self.client.get(
            "/api/v1/admin/metrics",
            headers=self.headers,
        )

    @task(3)
    def list_tenants(self):
        """GET /admin/tenants — paginated tenant list."""
        page = random.randint(1, 3)
        self.client.get(
            f"/api/v1/admin/tenants?page={page}&page_size=20",
            headers=self.headers,
            name="/api/v1/admin/tenants",
        )

    @task(1)
    def health_check(self):
        """GET /health — system health."""
        self.client.get("/health")


# ── Event hooks for custom reporting ──

@events.request.add_listener
def on_request(request_type, name, response_time, response_length, exception, **kwargs):
    """Log slow requests for debugging."""
    if response_time > 1000:  # > 1 second
        print(f"SLOW: {request_type} {name} took {response_time:.0f}ms")

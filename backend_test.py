import requests
import sys
import time
from datetime import datetime

class TempMailAPITester:
    def __init__(self, base_url="https://email-cycle-system.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.created_emails = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {response_data}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test("Root API", "GET", "", 200)

    def test_create_email(self):
        """Test creating a new temporary email"""
        success, response = self.run_test(
            "Create Email",
            "POST",
            "emails/create",
            200,
            data={}
        )
        if success and 'id' in response:
            self.created_emails.append(response)
            return True, response
        return False, {}

    def test_create_email_with_username(self):
        """Test creating email with custom username"""
        custom_username = f"testuser{int(time.time())}"
        success, response = self.run_test(
            "Create Email with Username",
            "POST",
            "emails/create",
            200,
            data={"username": custom_username}
        )
        if success and 'id' in response:
            self.created_emails.append(response)
            return True, response
        return False, {}

    def test_get_emails(self):
        """Test getting all emails"""
        return self.run_test("Get All Emails", "GET", "emails", 200)

    def test_get_email_by_id(self, email_id):
        """Test getting specific email by ID"""
        return self.run_test(
            f"Get Email {email_id}",
            "GET",
            f"emails/{email_id}",
            200
        )

    def test_get_email_messages(self, email_id):
        """Test getting messages for an email"""
        return self.run_test(
            f"Get Messages for {email_id}",
            "GET",
            f"emails/{email_id}/messages",
            200
        )

    def test_refresh_messages(self, email_id):
        """Test refreshing messages for an email"""
        return self.run_test(
            f"Refresh Messages for {email_id}",
            "POST",
            f"emails/{email_id}/refresh",
            200
        )

    def test_delete_email(self, email_id):
        """Test deleting an email"""
        return self.run_test(
            f"Delete Email {email_id}",
            "DELETE",
            f"emails/{email_id}",
            200
        )

    def test_nonexistent_email(self):
        """Test accessing non-existent email"""
        fake_id = "nonexistent-email-id"
        return self.run_test(
            "Get Non-existent Email",
            "GET",
            f"emails/{fake_id}",
            404
        )

    def test_nonexistent_email_messages(self):
        """Test getting messages for non-existent email"""
        fake_id = "nonexistent-email-id"
        return self.run_test(
            "Get Messages for Non-existent Email",
            "GET",
            f"emails/{fake_id}/messages",
            404
        )

def main():
    print("🚀 Starting TempMail API Tests...")
    print("=" * 50)
    
    tester = TempMailAPITester()
    
    # Test 1: Root endpoint
    tester.test_root_endpoint()
    
    # Test 2: Create email without username
    print("\n📧 Testing Email Creation...")
    success1, email1 = tester.test_create_email()
    
    # Test 3: Create email with custom username
    success2, email2 = tester.test_create_email_with_username()
    
    # Test 4: Get all emails
    print("\n📋 Testing Email Listing...")
    tester.test_get_emails()
    
    # Test 5: Get specific emails (if created successfully)
    if success1:
        print("\n🔍 Testing Individual Email Access...")
        tester.test_get_email_by_id(email1['id'])
        
        print("\n📨 Testing Message Operations...")
        tester.test_get_email_messages(email1['id'])
        tester.test_refresh_messages(email1['id'])
    
    if success2:
        tester.test_get_email_by_id(email2['id'])
        tester.test_get_email_messages(email2['id'])
        tester.test_refresh_messages(email2['id'])
    
    # Test 6: Error handling
    print("\n❌ Testing Error Handling...")
    tester.test_nonexistent_email()
    tester.test_nonexistent_email_messages()
    
    # Test 7: Delete emails (cleanup)
    print("\n🗑️ Testing Email Deletion...")
    for email in tester.created_emails:
        tester.test_delete_email(email['id'])
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
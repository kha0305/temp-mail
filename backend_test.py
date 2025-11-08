import requests
import sys
import time
from datetime import datetime, timezone, timedelta

class TempMailAPITester:
    def __init__(self, base_url="https://domain-mail-expand.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.created_emails = []
        self.history_emails = []

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
                if data is not None:
                    response = requests.delete(url, json=data, headers=headers, timeout=30)
                else:
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

    def test_extend_time(self, email_id):
        """Test extending email expiry time"""
        return self.run_test(
            f"Extend Time for {email_id}",
            "POST",
            f"emails/{email_id}/extend-time",
            200
        )

    def test_get_history(self):
        """Test getting email history"""
        return self.run_test("Get Email History", "GET", "emails/history/list", 200)

    def test_get_history_messages(self, email_id):
        """Test getting messages for a history email"""
        return self.run_test(
            f"Get History Messages for {email_id}",
            "GET",
            f"emails/history/{email_id}/messages",
            200
        )

    def test_delete_history_selective(self, ids):
        """Test deleting specific history emails"""
        return self.run_test(
            "Delete Selected History",
            "DELETE",
            "emails/history/delete",
            200,
            data={"ids": ids}
        )

    def test_delete_history_all(self):
        """Test deleting all history emails"""
        return self.run_test(
            "Delete All History",
            "DELETE",
            "emails/history/delete",
            200,
            data={"ids": None}
        )

    def verify_expiry_time(self, created_at_str, expires_at_str):
        """Verify that expires_at is approximately 10 minutes after created_at"""
        try:
            created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
            expires_at = datetime.fromisoformat(expires_at_str.replace('Z', '+00:00'))
            
            expected_expires = created_at + timedelta(minutes=10)
            time_diff = abs((expires_at - expected_expires).total_seconds())
            
            # Allow 5 seconds tolerance
            if time_diff <= 5:
                print(f"   ✅ Expiry time verified: ~10 minutes from creation")
                return True
            else:
                print(f"   ❌ Expiry time incorrect: {time_diff}s difference from expected")
                return False
        except Exception as e:
            print(f"   ❌ Error verifying expiry time: {e}")
            return False

    def verify_extend_time_reset(self, old_expires_at_str, new_expires_at_str):
        """Verify that extend time resets to ~10 minutes from now (not adds to old time)"""
        try:
            old_expires = datetime.fromisoformat(old_expires_at_str.replace('Z', '+00:00'))
            new_expires = datetime.fromisoformat(new_expires_at_str.replace('Z', '+00:00'))
            now = datetime.now(timezone.utc)
            
            expected_new_expires = now + timedelta(minutes=10)
            time_diff = abs((new_expires - expected_new_expires).total_seconds())
            
            # Verify it's reset to ~10 minutes from now (not added to old time)
            if time_diff <= 5:
                print(f"   ✅ Extend time verified: Reset to ~10 minutes from now")
                return True
            else:
                print(f"   ❌ Extend time incorrect: {time_diff}s difference from expected")
                return False
        except Exception as e:
            print(f"   ❌ Error verifying extend time: {e}")
            return False

def main():
    print("🚀 Starting TempMail API Tests - Email Expiry Features")
    print("=" * 70)
    
    tester = TempMailAPITester()
    
    # Test 1: Root endpoint
    tester.test_root_endpoint()
    
    # Test 2: Create email and verify expiry fields
    print("\n📧 Testing Email Creation with Expiry...")
    success1, email1 = tester.test_create_email()
    if success1:
        print(f"   Created email: {email1.get('address', 'N/A')}")
        print(f"   Created at: {email1.get('created_at', 'N/A')}")
        print(f"   Expires at: {email1.get('expires_at', 'N/A')}")
        
        # Verify expiry time is ~10 minutes from creation
        if 'created_at' in email1 and 'expires_at' in email1:
            tester.verify_expiry_time(email1['created_at'], email1['expires_at'])
    
    # Test 3: Create another email with custom username
    success2, email2 = tester.test_create_email_with_username()
    if success2:
        print(f"   Created email: {email2.get('address', 'N/A')}")
        print(f"   Expires at: {email2.get('expires_at', 'N/A')}")
    
    # Test 4: Get all emails and verify expires_at field
    print("\n📋 Testing Get Emails with Expiry Field...")
    success_list, emails_data = tester.test_get_emails()
    if success_list and isinstance(emails_data, list):
        print(f"   Found {len(emails_data)} email(s)")
        for email in emails_data:
            if 'expires_at' in email:
                print(f"   ✅ Email {email.get('address', 'N/A')} has expires_at field")
            else:
                print(f"   ❌ Email {email.get('address', 'N/A')} missing expires_at field")
    
    # Test 5: Extend Time (KEY FEATURE)
    if success1 and 'id' in email1:
        print("\n⏰ Testing Extend Time Feature (Reset to 10 minutes)...")
        old_expires_at = email1.get('expires_at')
        print(f"   Old expires_at: {old_expires_at}")
        
        success_extend, extend_data = tester.test_extend_time(email1['id'])
        if success_extend and 'expires_at' in extend_data:
            new_expires_at = extend_data['expires_at']
            print(f"   New expires_at: {new_expires_at}")
            
            # Verify it's reset to ~10 minutes from now (not added to old time)
            tester.verify_extend_time_reset(old_expires_at, new_expires_at)
    
    # Test 6: Get specific emails
    if success1:
        print("\n🔍 Testing Individual Email Access...")
        tester.test_get_email_by_id(email1['id'])
        
        print("\n📨 Testing Message Operations...")
        tester.test_get_email_messages(email1['id'])
        tester.test_refresh_messages(email1['id'])
    
    # Test 7: Email History
    print("\n📚 Testing Email History...")
    success_history, history_data = tester.test_get_history()
    if success_history:
        if isinstance(history_data, list):
            print(f"   Found {len(history_data)} history email(s)")
            if len(history_data) > 0:
                # Store first history email for testing
                first_history = history_data[0]
                tester.history_emails.append(first_history)
                print(f"   History email: {first_history.get('address', 'N/A')}")
                print(f"   Expired at: {first_history.get('expired_at', 'N/A')}")
                
                # Test getting messages from history
                if 'id' in first_history:
                    print("\n📨 Testing History Messages...")
                    tester.test_get_history_messages(first_history['id'])
            else:
                print("   ℹ️  No history emails yet (expected for new system)")
    
    # Test 8: Delete History - Selective
    if len(tester.history_emails) > 0:
        print("\n🗑️ Testing Selective History Deletion...")
        ids_to_delete = [tester.history_emails[0]['id']]
        success_del, del_data = tester.test_delete_history_selective(ids_to_delete)
        if success_del:
            print(f"   Deleted count: {del_data.get('count', 0)}")
    
    # Test 9: Delete History - All (if any remaining)
    print("\n🗑️ Testing Delete All History...")
    success_del_all, del_all_data = tester.test_delete_history_all()
    if success_del_all:
        print(f"   Deleted count: {del_all_data.get('count', 0)}")
    
    # Test 10: Error handling
    print("\n❌ Testing Error Handling...")
    tester.test_nonexistent_email()
    tester.test_nonexistent_email_messages()
    
    # Test 11: Delete emails (cleanup)
    print("\n🗑️ Testing Email Deletion (Cleanup)...")
    for email in tester.created_emails:
        tester.test_delete_email(email['id'])
    
    # Print final results
    print("\n" + "=" * 70)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
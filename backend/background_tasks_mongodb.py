"""Background tasks for MongoDB version - Auto-expire emails and create new ones"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from database_mongodb import emails_collection, history_collection

logger = logging.getLogger(__name__)

# Configuration
CHECK_INTERVAL = 30  # Check every 30 seconds


async def check_and_move_expired_emails():
    """Check for expired emails and move them to history"""
    try:
        now = datetime.now(timezone.utc)
        
        # Find emails that have expired
        cursor = emails_collection.find({})
        emails = await cursor.to_list(length=1000)
        
        expired_count = 0
        for email in emails:
            # Parse expires_at string to datetime
            expires_at_str = email.get("expires_at")
            if not expires_at_str:
                continue
            
            try:
                expires_at = datetime.fromisoformat(expires_at_str.replace('Z', '+00:00'))
            except Exception as e:
                logger.error(f"Error parsing expires_at '{expires_at_str}': {e}")
                continue
            
            if expires_at <= now:
                # Email has expired - move to history
                logger.info(f"⏰ Email expired: {email['address']}")
                
                # Create history document
                history_doc = {
                    "id": email["id"],
                    "address": email["address"],
                    "password": email["password"],
                    "token": email["token"],
                    "account_id": email["account_id"],
                    "created_at": email["created_at"],
                    "expired_at": now.isoformat(),
                    "message_count": email.get("message_count", 0),
                    "provider": email.get("provider", "mailtm")
                }
                
                # Insert into history
                await history_collection.insert_one(history_doc)
                
                # Delete from active emails
                await emails_collection.delete_one({"id": email["id"]})
                
                expired_count += 1
                logger.info(f"✅ Moved email {email['address']} to history")
        
        if expired_count > 0:
            logger.info(f"📦 Moved {expired_count} expired email(s) to history")
            
            # Check if we need to create a new email
            active_count = await emails_collection.count_documents({})
            if active_count == 0:
                logger.info("⚠️  No active emails found, but auto-create is handled by frontend now")
                # Don't auto-create here - let frontend handle it
        
    except Exception as e:
        logger.error(f"❌ Error in check_and_move_expired_emails: {e}")


async def background_task_loop():
    """Main background task loop"""
    logger.info(f"🚀 Background task started - checking every {CHECK_INTERVAL}s")
    
    while True:
        try:
            await check_and_move_expired_emails()
        except Exception as e:
            logger.error(f"❌ Error in background task loop: {e}")
        
        # Wait before next check
        await asyncio.sleep(CHECK_INTERVAL)


def start_background_tasks():
    """Start background tasks in a separate thread"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    # Run the background task
    def run_loop():
        loop.run_until_complete(background_task_loop())
    
    import threading
    thread = threading.Thread(target=run_loop, daemon=True)
    thread.start()
    
    logger.info("✅ Background tasks started (MongoDB version)")

'''
Business: Telegram бот для ведения огоньков между пользователями
Args: event - dict с httpMethod, body, queryStringParameters
      context - объект с request_id, function_name
Returns: HTTP response dict с результатами работы бота
'''

import json
import os
from typing import Dict, Any, Optional
from datetime import datetime, date, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor

def get_db_connection():
    database_url = os.environ.get('DATABASE_URL')
    return psycopg2.connect(database_url, cursor_factory=RealDictCursor)

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method: str = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    try:
        body_data = json.loads(event.get('body', '{}'))
        action = body_data.get('action')
        
        conn = get_db_connection()
        
        if action == 'register':
            result = register_user(conn, body_data)
        elif action == 'invite':
            result = invite_user(conn, body_data)
        elif action == 'accept_invite':
            result = accept_invite(conn, body_data)
        elif action == 'send_message':
            result = send_message(conn, body_data)
        elif action == 'get_streaks':
            result = get_user_streaks(conn, body_data)
        elif action == 'restore_streak':
            result = restore_streak(conn, body_data)
        elif action == 'check_daily':
            result = check_daily_streaks(conn)
        else:
            result = {'error': 'Unknown action'}
        
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps(result, ensure_ascii=False, default=str)
        }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': str(e)}, ensure_ascii=False)
        }

def register_user(conn, data: Dict[str, Any]) -> Dict[str, Any]:
    telegram_id = data.get('telegram_id')
    username = data.get('username')
    first_name = data.get('first_name', '')
    
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM users WHERE telegram_id = %s",
        (telegram_id,)
    )
    existing_user = cursor.fetchone()
    
    if existing_user:
        return {'status': 'already_registered', 'user': dict(existing_user)}
    
    cursor.execute(
        "INSERT INTO users (telegram_id, username, first_name) VALUES (%s, %s, %s) RETURNING *",
        (telegram_id, username, first_name)
    )
    user = cursor.fetchone()
    conn.commit()
    cursor.close()
    
    return {'status': 'registered', 'user': dict(user)}

def invite_user(conn, data: Dict[str, Any]) -> Dict[str, Any]:
    inviter_telegram_id = data.get('inviter_telegram_id')
    invitee_username = data.get('invitee_username')
    
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM users WHERE telegram_id = %s", (inviter_telegram_id,))
    inviter = cursor.fetchone()
    
    if not inviter:
        cursor.close()
        return {'error': 'Inviter not registered'}
    
    cursor.execute("SELECT * FROM users WHERE username = %s", (invitee_username,))
    invitee = cursor.fetchone()
    
    if not invitee:
        cursor.close()
        return {'error': 'Пользователь не зарегистрирован'}
    
    user1_id = min(inviter['id'], invitee['id'])
    user2_id = max(inviter['id'], invitee['id'])
    
    cursor.execute(
        "SELECT * FROM streaks WHERE user1_id = %s AND user2_id = %s",
        (user1_id, user2_id)
    )
    existing_streak = cursor.fetchone()
    
    if existing_streak:
        cursor.close()
        return {'error': 'Streak already exists'}
    
    cursor.execute(
        "INSERT INTO streaks (user1_id, user2_id, status) VALUES (%s, %s, 'pending') RETURNING *",
        (user1_id, user2_id)
    )
    streak = cursor.fetchone()
    conn.commit()
    cursor.close()
    
    return {
        'status': 'invite_sent',
        'streak': dict(streak),
        'invitee': dict(invitee)
    }

def accept_invite(conn, data: Dict[str, Any]) -> Dict[str, Any]:
    streak_id = data.get('streak_id')
    
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE streaks SET status = 'active', last_activity_date = %s WHERE id = %s RETURNING *",
        (date.today(), streak_id)
    )
    streak = cursor.fetchone()
    conn.commit()
    cursor.close()
    
    return {'status': 'accepted', 'streak': dict(streak)}

def send_message(conn, data: Dict[str, Any]) -> Dict[str, Any]:
    streak_id = data.get('streak_id')
    sender_telegram_id = data.get('sender_telegram_id')
    message_text = data.get('message_text', '')
    
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM users WHERE telegram_id = %s", (sender_telegram_id,))
    sender = cursor.fetchone()
    
    if not sender:
        cursor.close()
        return {'error': 'Sender not found'}
    
    cursor.execute("SELECT * FROM streaks WHERE id = %s", (streak_id,))
    streak = cursor.fetchone()
    
    if not streak:
        cursor.close()
        return {'error': 'Streak not found'}
    
    today = date.today()
    last_activity = streak.get('last_activity_date')
    
    if last_activity == today:
        pass
    elif last_activity == today - timedelta(days=1):
        cursor.execute(
            "UPDATE streaks SET current_streak = current_streak + 1, last_activity_date = %s WHERE id = %s",
            (today, streak_id)
        )
    else:
        cursor.execute(
            "UPDATE streaks SET current_streak = 1, last_activity_date = %s WHERE id = %s",
            (today, streak_id)
        )
    
    cursor.execute(
        "INSERT INTO messages (streak_id, sender_id, message_text) VALUES (%s, %s, %s) RETURNING *",
        (streak_id, sender['id'], message_text)
    )
    message = cursor.fetchone()
    conn.commit()
    
    cursor.execute("SELECT * FROM streaks WHERE id = %s", (streak_id,))
    updated_streak = cursor.fetchone()
    
    cursor.close()
    
    return {
        'status': 'message_sent',
        'message': dict(message),
        'streak': dict(updated_streak)
    }

def get_user_streaks(conn, data: Dict[str, Any]) -> Dict[str, Any]:
    telegram_id = data.get('telegram_id')
    
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE telegram_id = %s", (telegram_id,))
    user = cursor.fetchone()
    
    if not user:
        cursor.close()
        return {'error': 'User not found'}
    
    cursor.execute(
        """
        SELECT s.*, 
               u1.username as user1_username, u1.first_name as user1_name,
               u2.username as user2_username, u2.first_name as user2_name,
               (SELECT COUNT(*) FROM messages m WHERE m.streak_id = s.id AND m.is_read = false AND m.sender_id != %s) as unread_count
        FROM streaks s
        JOIN users u1 ON s.user1_id = u1.id
        JOIN users u2 ON s.user2_id = u2.id
        WHERE (s.user1_id = %s OR s.user2_id = %s) AND s.status = 'active'
        ORDER BY s.last_activity_date DESC
        """,
        (user['id'], user['id'], user['id'])
    )
    streaks = cursor.fetchall()
    cursor.close()
    
    return {
        'status': 'success',
        'streaks': [dict(s) for s in streaks],
        'user': dict(user)
    }

def restore_streak(conn, data: Dict[str, Any]) -> Dict[str, Any]:
    streak_id = data.get('streak_id')
    
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM streaks WHERE id = %s", (streak_id,))
    streak = cursor.fetchone()
    
    if not streak:
        cursor.close()
        return {'error': 'Streak not found'}
    
    current_month = datetime.now().month
    restore_count = streak.get('restore_count', 0)
    restore_month = streak.get('restore_month')
    
    if restore_month != current_month:
        restore_count = 0
    
    if restore_count >= 3:
        cursor.close()
        return {'error': 'Лимит восстановлений исчерпан (3 раза в месяц)'}
    
    last_activity = streak.get('last_activity_date')
    today = date.today()
    
    if last_activity and (today - last_activity).days <= 1:
        cursor.close()
        return {'error': 'Streak is still active'}
    
    cursor.execute(
        "UPDATE streaks SET restore_count = %s, restore_month = %s, last_activity_date = %s WHERE id = %s RETURNING *",
        (restore_count + 1, current_month, today, streak_id)
    )
    updated_streak = cursor.fetchone()
    conn.commit()
    cursor.close()
    
    return {
        'status': 'restored',
        'streak': dict(updated_streak),
        'restores_left': 3 - (restore_count + 1)
    }

def check_daily_streaks(conn) -> Dict[str, Any]:
    cursor = conn.cursor()
    today = date.today()
    yesterday = today - timedelta(days=1)
    
    cursor.execute(
        "SELECT * FROM streaks WHERE status = 'active' AND last_activity_date < %s",
        (yesterday,)
    )
    expired_streaks = cursor.fetchall()
    
    cursor.close()
    
    return {
        'status': 'checked',
        'expired_count': len(expired_streaks),
        'expired_streaks': [dict(s) for s in expired_streaks]
    }

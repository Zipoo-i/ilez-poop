from flask import Flask, jsonify, request, send_from_directory, session
import json
import os
import hashlib
import random

app = Flask(__name__)
app.secret_key = 'dnd-campaign-secret-key-2024'

FRONTEND_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../frontend')

USERS_FILE = 'users.json'

def load_users():
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_users(users):
    with open(USERS_FILE, 'w', encoding='utf-8') as f:
        json.dump(users, f, ensure_ascii=False, indent=2)

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    return response

def load_characters():
    try:
        with open('data.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []

def save_characters(characters):
    with open('data.json', 'w', encoding='utf-8') as f:
        json.dump(characters, f, ensure_ascii=False, indent=2)

def generate_parties(selected_ids):
    characters = load_characters()
    selected_characters = [c for c in characters if c['id'] in selected_ids]
    
    if len(selected_characters) < 2:
        return [selected_characters, [], []]
    
    party1 = balance_party_by_classes(selected_characters)
    party2 = balance_party_by_levels(selected_characters)
    party3 = random_party_algorithm(selected_characters)
    
    return [party1, party2, party3]

def balance_party_by_classes(characters):
    if not characters:
        return []
    
    class_groups = {}
    for char in characters:
        class_groups.setdefault(char['char_class'], []).append(char)
    
    balanced_party = []
    while any(class_groups.values()):
        for cls in list(class_groups.keys()):
            if class_groups[cls]:
                balanced_party.append(class_groups[cls].pop(0))
    
    return balanced_party[:4]

def balance_party_by_levels(characters):
    if not characters:
        return []
    
    sorted_chars = sorted(characters, key=lambda x: x['level'])
    
    party = []
    low = sorted_chars[:len(sorted_chars)//2]
    high = sorted_chars[len(sorted_chars)//2:]
    
    while low and high:
        if random.random() > 0.5:
            party.append(low.pop())
        else:
            party.append(high.pop())
    
    party.extend(low)
    party.extend(high)
    
    return party[:4]

def random_party_algorithm(characters):
    if not characters:
        return []
    
    random.shuffle(characters)
    return characters[:4]

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'player')
    
    if not username or not password:
        return jsonify({'error': 'Имя пользователя и пароль обязательны'}), 400
    
    users = load_users()
    
    if username in users:
        return jsonify({'error': 'Пользователь уже существует'}), 400
    
    users[username] = {
        'password': hash_password(password),
        'role': role
    }
    
    save_users(users)
    return jsonify({'message': 'Пользователь зарегистрирован'})

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    users = load_users()
    user = users.get(username)
    
    if user and user['password'] == hash_password(password):
        session['user'] = username
        session['role'] = user['role']
        return jsonify({
            'message': 'Вход выполнен',
            'user': username,
            'role': user['role']
        })
    
    return jsonify({'error': 'Неверные данные'}), 401

@app.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Выход выполнен'})

@app.route('/profile')
def profile():
    user = session.get('user')
    role = session.get('role')
    
    if user:
        return jsonify({'user': user, 'role': role})
    return jsonify({'error': 'Не авторизован'}), 401

@app.route('/characters', methods=['GET'])
def get_characters():
    return jsonify(load_characters())

@app.route('/characters', methods=['POST'])
def add_character():
    if session.get('role') != 'dm':
        return jsonify({'error': 'Только мастер может добавлять персонажей'}), 403
    
    data = request.json
    characters = load_characters()
    
    new_id = max([c['id'] for c in characters], default=0) + 1
    
    new_character = {
        'id': new_id,
        'name': data['name'],
        'race': data['race'],
        'char_class': data['char_class'],
        'level': data['level'],
        'player': data['player'],
        'background': data.get('background', '')
    }
    
    characters.append(new_character)
    save_characters(characters)
    return jsonify(new_character)

@app.route('/characters/<int:character_id>', methods=['PUT'])
def update_character(character_id):
    if session.get('role') != 'dm':
        return jsonify({'error': 'Только мастер может редактировать персонажей'}), 403
    
    data = request.json
    characters = load_characters()
    
    for character in characters:
        if character['id'] == character_id:
            character['name'] = data.get('name', character['name'])
            character['race'] = data.get('race', character['race'])
            character['char_class'] = data.get('char_class', character['char_class'])
            character['level'] = data.get('level', character['level'])
            character['player'] = data.get('player', character['player'])
            character['background'] = data.get('background', character['background'])
            
            save_characters(characters)
            return jsonify(character)
    
    return jsonify({'error': 'Персонаж не найден'}), 404

@app.route('/characters/<int:character_id>', methods=['DELETE'])
def delete_character(character_id):
    if session.get('role') != 'dm':
        return jsonify({'error': 'Только мастер может удалять персонажей'}), 403
    
    characters = load_characters()
    characters = [c for c in characters if c['id'] != character_id]
    save_characters(characters)
    return jsonify({'message': 'Персонаж удален'})

@app.route('/generate-parties', methods=['POST'])
def generate_parties_route():
    selected_ids = request.json
    parties = generate_parties(selected_ids)
    return jsonify(parties)

@app.route('/')
def serve_frontend():
    return send_from_directory(FRONTEND_PATH, 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory(FRONTEND_PATH, filename)

@app.route('/image/<path:filename>')
def serve_images(filename):
    return send_from_directory(os.path.join(FRONTEND_PATH, 'image'), filename)

if __name__ == '__main__':
    app.run(debug=True, port=5000, host='0.0.0.0')
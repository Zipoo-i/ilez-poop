let currentUser = null;
let currentRole = null;

document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
});

async function checkAuth() {
    try {
        const response = await fetch('/profile');
        if (response.ok) {
            const data = await response.json();
            showUserInterface(data.user, data.role);
        } else {
            showAuthInterface();
        }
    } catch (error) {
        showAuthInterface();
    }
}

async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        
        if (response.ok) {
            showUserInterface(data.user, data.role);
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('Ошибка сети: ' + error.message);
    }
}

async function register() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;

    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password, role })
        });

        const data = await response.json();
        
        if (response.ok) {
            alert(data.message);
            await login();
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('Ошибка сети: ' + error.message);
    }
}

async function logout() {
    try {
        await fetch('/logout', { method: 'POST' });
        showAuthInterface();
    } catch (error) {
        alert('Ошибка выхода: ' + error.message);
    }
}

async function loadCharacters() {
    try {
        const response = await fetch('/characters');
        const characters = await response.json();
        displayCharacters(characters);
    } catch (error) {
        console.error('Ошибка загрузки персонажей:', error);
    }
}

function displayCharacters(characters) {
    const container = document.getElementById('events-container');
    container.innerHTML = '';

    characters.forEach(character => {
        const charElement = document.createElement('div');
        charElement.className = 'event-item';
        charElement.innerHTML = `
            <label>
                <input type="checkbox" value="${character.id}">
                <strong>${character.name}</strong> - ${character.race} ${character.char_class} (Ур. ${character.level})<br>
                <small>Игрок: ${character.player} | Предыстория: ${character.background || 'нет'}</small>
            </label>
            ${currentRole === 'dm' ? `
                <div class="event-actions">
                    <button class="edit-btn" onclick="editCharacter(${character.id})">✏️</button>
                    <button class="delete-btn" onclick="deleteCharacter(${character.id})">❌</button>
                </div>
            ` : ''}
        `;
        container.appendChild(charElement);
    });
}

async function generateParties() {
    const selectedIds = [];
    document.querySelectorAll('#events-container input[type="checkbox"]:checked').forEach(checkbox => {
        selectedIds.push(parseInt(checkbox.value));
    });

    if (selectedIds.length === 0) {
        alert('Выберите хотя бы одного персонажа');
        return;
    }

    try {
        const response = await fetch('/generate-parties', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(selectedIds)
        });

        const parties = await response.json();
        displayParties(parties);
    } catch (error) {
        alert('Ошибка генерации отрядов: ' + error.message);
    }
}

function displayParties(parties) {
    const results = document.getElementById('results');
    results.innerHTML = '<h2>Предложенные отряды:</h2>';

    parties.forEach((party, index) => {
        if (party.length === 0) return;

        const partyCard = document.createElement('div');
        partyCard.className = 'route-card';
        partyCard.innerHTML = `<h3>Отряд ${index + 1} (${party.length} персонажей)</h3>`;
        
        let totalLevel = 0;
        const classes = {};
        
        party.forEach(character => {
            const charElement = document.createElement('div');
            charElement.className = 'event-route';
            charElement.innerHTML = `
                <strong>${character.name}</strong> - ${character.race} ${character.char_class} (Ур. ${character.level})<br>
                <small>Игрок: ${character.player}</small>
            `;
            partyCard.appendChild(charElement);
            
            totalLevel += character.level;
            classes[character.char_class] = (classes[character.char_class] || 0) + 1;
        });
        
        const summary = document.createElement('div');
        summary.className = 'party-summary';
        summary.innerHTML = `<small>Средний уровень: ${(totalLevel/party.length).toFixed(1)} | Состав: ${Object.entries(classes).map(([cls, count]) => `${cls}: ${count}`).join(', ')}</small>`;
        partyCard.appendChild(summary);
        
        results.appendChild(partyCard);
    });
}

async function addCharacter() {
    const name = document.getElementById('char-name').value;
    const race = document.getElementById('char-race').value;
    const char_class = document.getElementById('char-class').value;
    const level = document.getElementById('char-level').value;
    const player = document.getElementById('char-player').value;
    const background = document.getElementById('char-background').value;

    if (!name || !race || !char_class || !level || !player) {
        alert('Заполните все обязательные поля');
        return;
    }

    try {
        const response = await fetch('/characters', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                name, 
                race, 
                char_class, 
                level: parseInt(level), 
                player, 
                background 
            })
        });

        if (response.ok) {
            alert('Персонаж добавлен!');
            loadCharacters();
            document.getElementById('char-name').value = '';
            document.getElementById('char-race').value = '';
            document.getElementById('char-class').value = '';
            document.getElementById('char-level').value = '';
            document.getElementById('char-player').value = '';
            document.getElementById('char-background').value = '';
        } else {
            const error = await response.json();
            alert(error.error);
        }
    } catch (error) {
        alert('Ошибка добавления персонажа: ' + error.message);
    }
}

async function deleteCharacter(characterId) {
    if (!confirm('Удалить персонажа?')) {
        return;
    }

    try {
        const response = await fetch(`/characters/${characterId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadCharacters();
        } else {
            const error = await response.json();
            alert(error.error);
        }
    } catch (error) {
        alert('Ошибка удаления персонажа: ' + error.message);
    }
}

async function editCharacter(characterId) {
    try {
        const response = await fetch('/characters');
        const characters = await response.json();
        const character = characters.find(c => c.id === characterId);
        
        if (!character) {
            alert('Персонаж не найден');
            return;
        }
        
        const newName = prompt('Имя персонажа:', character.name);
        if (!newName) return;
        
        const newRace = prompt('Раса:', character.race);
        if (!newRace) return;
        
        const newClass = prompt('Класс:', character.char_class);
        if (!newClass) return;
        
        const newLevel = prompt('Уровень:', character.level);
        if (!newLevel) return;
        
        const newPlayer = prompt('Игрок:', character.player);
        if (!newPlayer) return;
        
        const newBackground = prompt('Предыстория:', character.background || '');
        
        const updateResponse = await fetch(`/characters/${characterId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: newName,
                race: newRace,
                char_class: newClass,
                level: parseInt(newLevel),
                player: newPlayer,
                background: newBackground
            })
        });
        
        if (updateResponse.ok) {
            alert('Персонаж обновлен!');
            loadCharacters();
        } else {
            const error = await updateResponse.json();
            alert(error.error);
        }
    } catch (error) {
        alert('Ошибка редактирования: ' + error.message);
    }
}

function showAuthInterface() {
    document.getElementById('auth-panel').style.display = 'block';
    document.getElementById('user-info').style.display = 'none';
    document.getElementById('main-interface').style.display = 'none';
    document.body.classList.remove('authenticated');
}

function showUserInterface(user, role) {
    currentUser = user;
    currentRole = role;
    
    document.getElementById('auth-panel').style.display = 'none';
    document.getElementById('user-info').style.display = 'block';
    document.getElementById('main-interface').style.display = 'block';
    document.getElementById('current-user').textContent = user;
    document.getElementById('current-role').textContent = role === 'dm' ? 'Мастер' : 'Игрок';
    document.body.classList.add('authenticated');
    
    if (role === 'dm') {
        document.getElementById('dm-panel').style.display = 'block';
    } else {
        document.getElementById('dm-panel').style.display = 'none';
    }
    
    loadCharacters();
}

document.addEventListener('DOMContentLoaded', function() {
    const passwordInput = document.getElementById('password');
    passwordInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            login();
        }
    });
});
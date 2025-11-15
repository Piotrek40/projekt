# RPG Narrative Engine

Lokalna webowa aplikacja do tworzenia i grania w narracyjne gry RPG z elementami dark fantasy.

## Opis Projektu

**RPG Narrative Engine** to pełna aplikacja full-stack składająca się z:

- **Backend**: Python 3 + FastAPI + SQLite
- **Frontend**: React + Vite + TailwindCSS
- **Funkcje**:
  - Silnik gry narracyjnej z systemem wyborów i konsekwencji
  - System statystyk postaci (Siła, Spryt, Charyzma)
  - Testy umiejętności z rzutami k20
  - System ekwipunku i flag fabularnych
  - Wiele slotów zapisu gry
  - Edytor kampanii (tworzenie lokacji, NPC, węzłów narracyjnych)

## Gotowa Kampania

Aplikacja zawiera gotową kampanię: **"The Shadow of Thornhaven"**

- Czas gry: 1-2 godziny
- 4 różne zakończenia (sacrifice, dark_triumph, escape, failed)
- Moralnie nieoczywiste wybory
- Klimat mrocznego fantasy
- ~16 węzłów narracyjnych z testami umiejętności

## Wymagania

### Windows 11

- **Python 3.11+** (pobierz z https://www.python.org/downloads/)
  - Podczas instalacji zaznacz "Add Python to PATH"
- **Node.js 18+** (pobierz z https://nodejs.org/)
- **Git** (opcjonalnie, jeśli klonujesz repozytorium)

---

## Instalacja i Uruchomienie (Windows 11)

### Krok 1: Pobierz projekt

Jeśli masz Git:
```bash
git clone <url-repozytorium>
cd projekt
```

Jeśli nie masz Git - pobierz i rozpakuj archiwum ZIP projektu.

---

### Krok 2: Uruchom Backend (Python + FastAPI)

Otwórz **Command Prompt** (cmd) lub **PowerShell** w folderze projektu.

#### 2.1. Stwórz wirtualne środowisko Python

```bash
cd backend
python -m venv venv
```

#### 2.2. Aktywuj wirtualne środowisko

**Na Windows Command Prompt:**
```bash
venv\Scripts\activate
```

**Na Windows PowerShell:**
```powershell
venv\Scripts\Activate.ps1
```

> **Uwaga**: Jeśli PowerShell nie pozwala uruchomić skryptu, uruchom:
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```

#### 2.3. Zainstaluj zależności

```bash
pip install -r requirements.txt
```

#### 2.4. Zainicjuj bazę danych i załaduj kampanię

```bash
python seed_db.py
```

Powinieneś zobaczyć:
```
✓ Database seeded successfully!
```

#### 2.5. Uruchom serwer backend

```bash
uvicorn app.main:app --reload
```

Serwer uruchomi się na: **http://127.0.0.1:8000**

Dokumentacja API dostępna pod: **http://127.0.0.1:8000/docs**

> **Zostaw to okno terminala otwarte** - backend musi działać w tle!

---

### Krok 3: Uruchom Frontend (React + Vite)

Otwórz **nowe** okno Command Prompt lub PowerShell w folderze projektu.

#### 3.1. Przejdź do folderu frontend

```bash
cd frontend
```

#### 3.2. Zainstaluj zależności npm

```bash
npm install
```

#### 3.3. Uruchom serwer deweloperski Vite

```bash
npm run dev
```

Frontend uruchomi się na: **http://localhost:5173**

---

### Krok 4: Graj!

1. Otwórz przeglądarkę i wejdź na: **http://localhost:5173**
2. Zobaczysz stronę główną z dwiema opcjami:
   - **Play Game** - zacznij grę
   - **Campaign Editor** - edytuj kampanie

#### Rozpoczęcie gry:

1. Kliknij **"Play Game"**
2. Kliknij **"New Game"**
3. Wybierz kampanię: "The Shadow of Thornhaven"
4. Wpisz imię postaci i nazwę slotu zapisu
5. Ustaw statystyki (domyślnie 10/10/10)
6. Kliknij **"Start Adventure"**
7. Czytaj narrację i wybieraj opcje!

---

## Testy Jednostkowe

Backend zawiera testy jednostkowe dla logiki gry.

### Uruchomienie testów:

```bash
cd backend
venv\Scripts\activate
pytest tests/ -v
```

Wszystkie testy powinny przejść pomyślnie (10/10).

---

## Struktura Projektu

```
projekt/
├── backend/
│   ├── app/
│   │   ├── main.py           # Główna aplikacja FastAPI
│   │   ├── models.py         # Modele SQLAlchemy
│   │   ├── schemas.py        # Schematy Pydantic
│   │   ├── db.py             # Konfiguracja bazy danych
│   │   ├── game_engine.py    # Logika silnika gry
│   │   ├── seed.py           # Dane startowe (kampania)
│   │   └── routes/
│   │       ├── campaigns.py  # API edytora kampanii
│   │       └── game.py       # API rozgrywki
│   ├── tests/
│   │   └── test_game_logic.py
│   ├── seed_db.py            # Skrypt seedowania bazy
│   ├── requirements.txt
│   └── rpg_narrative.db      # Baza SQLite (po seedowaniu)
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js     # API client
│   │   ├── pages/
│   │   │   ├── Home.jsx      # Strona główna
│   │   │   ├── Game.jsx      # Interfejs gry
│   │   │   └── Editor.jsx    # Edytor kampanii
│   │   ├── App.jsx           # Główny komponent
│   │   └── index.css         # Style (Tailwind)
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

---

## API Endpoints

Backend udostępnia RESTful API:

### Campaigns (Edytor)
- `GET /api/campaigns` - Lista kampanii
- `POST /api/campaigns` - Utwórz kampanię
- `GET /api/campaigns/{id}` - Szczegóły kampanii
- `PATCH /api/campaigns/{id}` - Zaktualizuj kampanię
- `DELETE /api/campaigns/{id}` - Usuń kampanię

### Locations
- `GET /api/campaigns/{id}/locations` - Lista lokacji
- `POST /api/campaigns/{id}/locations` - Utwórz lokację

### NPCs
- `GET /api/campaigns/{id}/npcs` - Lista NPC
- `POST /api/campaigns/{id}/npcs` - Utwórz NPC

### Narrative Nodes
- `GET /api/campaigns/{id}/nodes` - Lista węzłów
- `POST /api/campaigns/{id}/nodes` - Utwórz węzeł
- `GET /api/campaigns/nodes/{id}` - Szczegóły węzła

### Game Play
- `POST /api/game/start` - Rozpocznij nową grę
- `GET /api/game/states` - Lista zapisanych gier
- `GET /api/game/states/{id}` - Wczytaj grę
- `POST /api/game/choice` - Wykonaj wybór
- `DELETE /api/game/states/{id}` - Usuń zapis

Pełna dokumentacja: http://127.0.0.1:8000/docs

---

## Rozwiązywanie Problemów

### Backend nie uruchamia się

1. Sprawdź czy Python jest w PATH:
   ```bash
   python --version
   ```

2. Sprawdź czy venv jest aktywowane (w terminalu powinno być `(venv)`).

3. Sprawdź czy port 8000 nie jest zajęty:
   ```bash
   netstat -ano | findstr :8000
   ```

### Frontend nie uruchamia się

1. Sprawdź czy Node.js jest zainstalowane:
   ```bash
   node --version
   npm --version
   ```

2. Usuń `node_modules` i zainstaluj ponownie:
   ```bash
   rm -rf node_modules
   npm install
   ```

### CORS errors w przeglądarce

- Upewnij się, że backend działa na http://127.0.0.1:8000
- Upewnij się, że frontend działa na http://localhost:5173
- CORS jest skonfigurowany w `backend/app/main.py`

---

## Funkcje Gry

### System Statystyk
- **Strength (Siła)**: Używana w testach fizycznych
- **Agility (Spryt)**: Używana w testach zręczności i refleksu
- **Charisma (Charyzma)**: Używana w interakcjach społecznych

### Testy Umiejętności
- Rzut k20 + modyfikator ze statystyki vs. trudność
- Modyfikator: `(statystyka - 10) / 2`
- Przykład: Siła 14 daje +2 do testów Siły

### System Wyborów
- Wybory mogą mieć warunki (wymagany przedmiot, poziom, flaga)
- Wybory mogą dawać efekty (dodaj przedmiot, ustaw flagę, daj XP)
- Niektóre węzły wymagają testów umiejętności

### Zakończenia
Kampania "The Shadow of Thornhaven" ma 4 możliwe zakończenia:
1. **Sacrifice** - Heroiczne poświęcenie
2. **Dark Triumph** - Mroczna władza
3. **Escape** - Pragmatyczna ucieczka
4. **Failed to Save** - Porażka moralna

---

## Tworzenie Własnych Kampanii

### Przez Edytor (UI)

1. Wejdź do **Campaign Editor**
2. Kliknij **"+ New"** aby stworzyć kampanię
3. Dodaj **Locations** (lokacje)
4. Dodaj **NPCs** (postacie niezależne)
5. Dodaj **Nodes** (węzły narracyjne)
6. Zaznacz węzeł startowy klikając **"Set Start"**

### Zaawansowana edycja (przez kod lub API)

Aby dodać wybory (choices) z warunkami i efektami, użyj:
- Dokumentacji API: http://127.0.0.1:8000/docs
- Edycji bezpośrednio w bazie SQLite
- Inspiracji kodem w `backend/app/seed.py`

Przykładowy choice z warunkami:
```json
{
  "text": "Otwórz drzwi magicznym kluczem",
  "target_node_id": 10,
  "conditions": {
    "required_item": "magic_key",
    "min_level": 3
  },
  "effects": {
    "set_flag": "opened_secret_door",
    "add_xp": 50
  }
}
```

---

## Licencja

Ten projekt został stworzony jako demonstracja pełnego stosu technologicznego.

---

## Autor

Projekt zrealizowany w 100% przez Claude Code (Anthropic) jako pełna implementacja od A do Z.

---

## Kontakt / Wsparcie

Jeśli masz pytania lub problemy:
1. Sprawdź sekcję "Rozwiązywanie Problemów"
2. Sprawdź logi w terminalach (backend i frontend)
3. Sprawdź dokumentację API: http://127.0.0.1:8000/docs

---

**Miłej gry! ⚔️🎭**

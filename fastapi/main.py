# ============================================
# SERVEUR FASTAPI - Gestion du catalogue films
# ============================================
# FastAPI est un framework Python pour créer des API web
# Une API = un service qui reçoit des requêtes et répond en JSON

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel  # Pour valider les données reçues
import pymysql                  # Pour se connecter à MySQL
from typing import Optional     # Pour les champs optionnels

# Créer l'application FastAPI (comme créer un projet Windev)
app = FastAPI(title="API Gestion Films")

# CORS = autoriser le frontend à appeler cette API
# Sans ça, le navigateur bloque les requêtes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En production, mettre l'URL exacte du frontend
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# CONNEXION À MYSQL
# Comme HFOuvre() en Windev
# ============================================
def get_connection():
    return pymysql.connect(
        host="localhost",
        user="filmuser",        # utilisateur créé précédemment
        password="filmpass123", # mot de passe
        database="gestion_films",
        cursorclass=pymysql.cursors.DictCursor  # retourne des dictionnaires
    )

# ============================================
# MODÈLES DE DONNÉES
# Comme définir les colonnes d'une table Windev
# ============================================
class Film(BaseModel):
    titre: str
    realisateur: Optional[str] = None
    annee: Optional[int] = None
    genre: Optional[str] = None

# ============================================
# ROUTES = POINTS D'ENTRÉE DE L'API
# Comme des procédures web en Windev
# ============================================

# Route de test (pour vérifier que le serveur fonctionne)
@app.get("/")
def accueil():
    return {"message": "API Films opérationnelle !"}

# GET /films → Récupérer tous les films
# Comme HLitPremier() + HLitSuivant() en Windev
@app.get("/films")
def liste_films():
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM films")
            films = cursor.fetchall()  # Récupère toutes les lignes
        return films
    finally:
        conn.close()  # Toujours fermer la connexion

# GET /films/{id} → Récupérer un film par son ID
@app.get("/films/{film_id}")
def get_film(film_id: int):
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM films WHERE id = %s", (film_id,))
            film = cursor.fetchone()  # Récupère une seule ligne
            if not film:
                # Erreur 404 si film non trouvé
                raise HTTPException(status_code=404, detail="Film non trouvé")
        return film
    finally:
        conn.close()

# POST /films → Ajouter un nouveau film
# Comme HAjoute() en Windev
@app.post("/films")
def ajouter_film(film: Film):
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            sql = """INSERT INTO films (titre, realisateur, annee, genre)
                     VALUES (%s, %s, %s, %s)"""
            cursor.execute(sql, (film.titre, film.realisateur, film.annee, film.genre))
            conn.commit()  # Valider la transaction (comme HValide() en Windev)
            return {"message": "Film ajouté avec succès", "id": cursor.lastrowid}
    finally:
        conn.close()

# PUT /films/{id} → Modifier un film existant
# Comme HModifie() en Windev
@app.put("/films/{film_id}")
def modifier_film(film_id: int, film: Film):
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            sql = """UPDATE films SET titre=%s, realisateur=%s, annee=%s, genre=%s
                     WHERE id=%s"""
            cursor.execute(sql, (film.titre, film.realisateur, film.annee, film.genre, film_id))
            conn.commit()
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Film non trouvé")
        return {"message": "Film modifié avec succès"}
    finally:
        conn.close()

# DELETE /films/{id} → Supprimer un film
# Comme HSupprime() en Windev
@app.delete("/films/{film_id}")
def supprimer_film(film_id: int):
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM films WHERE id = %s", (film_id,))
            conn.commit()
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Film non trouvé")
        return {"message": "Film supprimé avec succès"}
    finally:
        conn.close()

# GET /films/disponibles → Films disponibles à l'emprunt
@app.get("/films/disponibles/liste")
def films_disponibles():
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM films WHERE disponible = TRUE")
            films = cursor.fetchall()
        return films
    finally:
        conn.close()

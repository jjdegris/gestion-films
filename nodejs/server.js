// ============================================
// SERVEUR NODEJS - Gestion clients & emprunts
// ============================================
// Express est le framework web de NodeJS
// Comme FastAPI mais en JavaScript

const express = require('express');  // Charger Express
const mysql2  = require('mysql2');   // Charger le module MySQL
const axios   = require('axios');    // Pour appeler l'API FastAPI
const cors    = require('cors');     // Pour autoriser le frontend

// Créer l'application Express
const app  = express();
const PORT = 3000; // Port d'écoute (différent de FastAPI qui est sur 8000)

// ============================================
// MIDDLEWARES
// Ce sont des fonctions qui s'exécutent avant
// chaque requête (comme des triggers Windev)
// ============================================
app.use(cors());                     // Autoriser toutes les origines
app.use(express.json());             // Lire le JSON des requêtes

// ============================================
// CONNEXION MYSQL
// Comme HFOuvre() en Windev
// ============================================
const db = mysql2.createConnection({
    host     : 'localhost',
    user     : 'filmuser',
    password : 'filmpass123',
    database : 'gestion_films'
});

// Se connecter à MySQL au démarrage
db.connect((err) => {
    if (err) {
        console.error('Erreur connexion MySQL:', err);
        return;
    }
    console.log('✅ Connecté à MySQL !');
});

// ============================================
// ROUTES CLIENTS
// ============================================

// GET /clients → Liste tous les clients
app.get('/clients', (req, res) => {
    const sql = 'SELECT * FROM clients';
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ erreur: err.message });
        res.json(results); // Retourner les résultats en JSON
    });
});

// GET /clients/:id → Récupérer un client par son ID
app.get('/clients/:id', (req, res) => {
    const sql = 'SELECT * FROM clients WHERE id = ?';
    db.query(sql, [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ erreur: err.message });
        if (results.length === 0)
            return res.status(404).json({ erreur: 'Client non trouvé' });
        res.json(results[0]); // Retourner le premier résultat
    });
});

// POST /clients → Ajouter un nouveau client
// Comme HAjoute() en Windev
app.post('/clients', (req, res) => {
    // Extraire les données envoyées par le frontend
    const { nom, prenom, email, telephone } = req.body;

    // Vérifier que les champs obligatoires sont présents
    if (!nom || !prenom || !email)
        return res.status(400).json({ erreur: 'nom, prenom et email sont obligatoires' });

    const sql = 'INSERT INTO clients (nom, prenom, email, telephone) VALUES (?, ?, ?, ?)';
    db.query(sql, [nom, prenom, email, telephone], (err, result) => {
        if (err) return res.status(500).json({ erreur: err.message });
        res.json({ message: 'Client ajouté !', id: result.insertId });
    });
});

// PUT /clients/:id → Modifier un client
app.put('/clients/:id', (req, res) => {
    const { nom, prenom, email, telephone } = req.body;
    const sql = 'UPDATE clients SET nom=?, prenom=?, email=?, telephone=? WHERE id=?';
    db.query(sql, [nom, prenom, email, telephone, req.params.id], (err, result) => {
        if (err) return res.status(500).json({ erreur: err.message });
        if (result.affectedRows === 0)
            return res.status(404).json({ erreur: 'Client non trouvé' });
        res.json({ message: 'Client modifié !' });
    });
});

// DELETE /clients/:id → Supprimer un client
app.delete('/clients/:id', (req, res) => {
    const sql = 'DELETE FROM clients WHERE id = ?';
    db.query(sql, [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ erreur: err.message });
        if (result.affectedRows === 0)
            return res.status(404).json({ erreur: 'Client non trouvé' });
        res.json({ message: 'Client supprimé !' });
    });
});

// ============================================
// ROUTES EMPRUNTS
// ============================================

// GET /emprunts → Liste tous les emprunts avec détails
app.get('/emprunts', (req, res) => {
    // Jointure entre 3 tables (comme une requête HyperFile avec liaison)
    const sql = `
        SELECT
            e.id,
            e.date_emprunt,
            e.date_retour_prevue,
            e.date_retour_reelle,
            c.nom, c.prenom, c.email,
            f.titre, f.genre
        FROM emprunts e
        JOIN clients c ON e.client_id = c.id
        JOIN films   f ON e.film_id   = f.id
        ORDER BY e.date_emprunt DESC
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ erreur: err.message });
        res.json(results);
    });
});

// POST /emprunts → Créer un emprunt
app.post('/emprunts', async (req, res) => {
    const { film_id, client_id, date_retour_prevue } = req.body;

    if (!film_id || !client_id || !date_retour_prevue)
        return res.status(400).json({ erreur: 'film_id, client_id et date_retour_prevue sont obligatoires' });

    try {
        // Vérifier que le film est disponible via FastAPI
        // C'est la communication entre NodeJS et FastAPI !
        const response = await axios.get(`http://127.0.0.1:8000/films/${film_id}`);
        const film = response.data;

        if (!film.disponible)
            return res.status(400).json({ erreur: 'Ce film est déjà emprunté !' });

        // Insérer l'emprunt dans MySQL
        const sql = 'INSERT INTO emprunts (film_id, client_id, date_retour_prevue) VALUES (?, ?, ?)';
        db.query(sql, [film_id, client_id, date_retour_prevue], (err, result) => {
            if (err) return res.status(500).json({ erreur: err.message });

            // Marquer le film comme non disponible dans FastAPI
            axios.put(`http://127.0.0.1:8000/films/${film_id}`, {
                titre        : film.titre,
                realisateur  : film.realisateur,
                annee        : film.annee,
                genre        : film.genre,
                disponible   : false
            });

            res.json({ message: 'Emprunt enregistré !', id: result.insertId });
        });

    } catch (error) {
        res.status(500).json({ erreur: 'Erreur lors de la vérification du film' });
    }
});

// PUT /emprunts/:id/retour → Enregistrer le retour d'un film
app.put('/emprunts/:id/retour', (req, res) => {
    // Récupérer l'emprunt pour avoir le film_id
    db.query('SELECT * FROM emprunts WHERE id = ?', [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ erreur: err.message });
        if (results.length === 0)
            return res.status(404).json({ erreur: 'Emprunt non trouvé' });

        const emprunt = results[0];

        // Mettre à jour la date de retour réelle
        const sql = 'UPDATE emprunts SET date_retour_reelle = CURDATE() WHERE id = ?';
        db.query(sql, [req.params.id], async (err) => {
            if (err) return res.status(500).json({ erreur: err.message });

            // Remettre le film disponible via FastAPI
            try {
                const filmRes = await axios.get(`http://127.0.0.1:8000/films/${emprunt.film_id}`);
                const film = filmRes.data;
                await axios.put(`http://127.0.0.1:8000/films/${emprunt.film_id}`, {
                    titre       : film.titre,
                    realisateur : film.realisateur,
                    annee       : film.annee,
                    genre       : film.genre,
                    disponible  : true
                });
            } catch (e) {
                console.error('Erreur mise à jour disponibilité film:', e.message);
            }

            res.json({ message: 'Retour enregistré, film de nouveau disponible !' });
        });
    });
});

// ============================================
// DÉMARRER LE SERVEUR
// ============================================
app.listen(PORT, () => {
    console.log(`✅ Serveur NodeJS démarré sur http://127.0.0.1:${PORT}`);
});

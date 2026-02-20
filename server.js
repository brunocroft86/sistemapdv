const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const db = new sqlite3.Database('./database.db');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// --- BANCO DE DADOS ---
db.serialize(() => {
    // Tabela de Produtos (Com coluna de ORDEM)
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        price REAL,
        stock INTEGER,
        display_order INTEGER DEFAULT 9999
    )`);

    // Tabela de Vendas
    db.run(`CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        total_value REAL,
        payment_method TEXT,
        items_summary TEXT,
        sale_date TEXT
    )`);
});

// --- ROTAS (API) ---

// 1. Listar Produtos (Ordenado pela posição personalizada)
app.get('/api/products', (req, res) => {
    db.all("SELECT * FROM products ORDER BY display_order ASC, id ASC", [], (err, rows) => {
        if (err) return res.status(500).json(err);
        res.json(rows);
    });
});

// 2. Cadastrar Produto
app.post('/api/products', (req, res) => {
    const { name, price, stock } = req.body;
    // Novos itens vão para o final (ordem 9999)
    db.run("INSERT INTO products (name, price, stock, display_order) VALUES (?, ?, ?, 9999)", 
        [name, price, stock], 
        function(err) {
            if (err) return res.status(500).json(err);
            res.json({ id: this.lastID });
        }
    );
});

// 3. Atualizar Produto (PUT)
app.put('/api/products/:id', (req, res) => {
    const { name, price, stock } = req.body;
    const { id } = req.params;
    db.run("UPDATE products SET name = ?, price = ?, stock = ? WHERE id = ?",
        [name, price, stock, id],
        function(err) {
            if (err) return res.status(500).json(err);
            res.json({ message: "Atualizado com sucesso" });
        }
    );
});

// 4. Excluir Produto (DELETE)
app.delete('/api/products/:id', (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM products WHERE id = ?", id, function(err) {
        if (err) return res.status(500).json(err);
        res.json({ message: "Deletado com sucesso" });
    });
});

// 5. SALVAR NOVA ORDEM (Drag & Drop)
app.post('/api/products/reorder', (req, res) => {
    const { order } = req.body; // Recebe lista de IDs [5, 2, 1, 8...]
    
    db.serialize(() => {
        const stmt = db.prepare("UPDATE products SET display_order = ? WHERE id = ?");
        order.forEach((id, index) => {
            stmt.run(index, id); // O índice do array vira a nova posição
        });
        stmt.finalize();
        res.json({ success: true });
    });
});

// 6. Finalizar Venda
app.post('/api/checkout', (req, res) => {
    const { cart, paymentMethod, total } = req.body;
    const date = new Date().toLocaleString('pt-BR');
    
    let summary = cart.map(item => `${item.qtd}x ${item.name}`).join(', ');

    db.serialize(() => {
        const updateStock = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?");
        cart.forEach(item => {
            updateStock.run(item.qtd, item.id);
        });
        updateStock.finalize();

        db.run("INSERT INTO sales (total_value, payment_method, items_summary, sale_date) VALUES (?, ?, ?, ?)",
            [total, paymentMethod, summary, date],
            function(err) {
                if (err) return res.status(500).json(err);
                res.json({ message: "Venda concluída!" });
            }
        );
    });
});

// 7. Relatório de Vendas
app.get('/api/sales', (req, res) => {
    db.all("SELECT * FROM sales ORDER BY id DESC", [], (err, rows) => {
        if (err) return res.status(500).json(err);
        res.json(rows);
    });
});

app.listen(3000, () => {
    console.log('Sistema rodando em http://localhost:3000');
});
const API_URL = 'http://localhost:3000/api';
let cart = [];

// --- NAVEGAÇÃO ---
function showTab(tabId) {
    document.querySelectorAll('.tab').forEach(t => t.style.display = 'none');
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).style.display = 'block';
    event.target.classList.add('active');

    if(tabId === 'pos') loadProducts(); // Carrega produtos
    if(tabId === 'stock') loadStock();
    if(tabId === 'reports') loadSales();
}

// --- CAIXA (PDV) COM ARRASTE ---
async function loadProducts() {
    const res = await fetch(`${API_URL}/products`);
    const products = await res.json();
    const grid = document.getElementById('pos-grid');
    grid.innerHTML = '';
    
    products.forEach(p => {
        if(p.stock > 0) {
            const card = document.createElement('div');
            card.className = 'card';
            // ID Oculto para identificar o arraste
            card.setAttribute('data-id', p.id);
            card.innerHTML = `<h3>${p.name}</h3><div class="price">R$ ${p.price.toFixed(2)}</div><small>Est: ${p.stock}</small>`;
            card.onclick = () => addToCart(p);
            grid.appendChild(card);
        }
    });

    // ATIVA O SORTABLE (DRAG & DROP)
    if (!grid.sortableInstance) {
        grid.sortableInstance = new Sortable(grid, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: function () {
                saveNewOrder(); // Salva quando soltar
            }
        });
    }
}

// Salva a ordem visual no banco
async function saveNewOrder() {
    const grid = document.getElementById('pos-grid');
    const itemIds = Array.from(grid.children).map(card => card.getAttribute('data-id'));
    
    await fetch(`${API_URL}/products/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: itemIds })
    });
}

function addToCart(product) {
    const existing = cart.find(item => item.id === product.id);
    if(existing) {
        if(existing.qtd >= product.stock) return alert("Limite de estoque atingido!");
        existing.qtd++;
    } else {
        cart.push({ ...product, qtd: 1 });
    }
    updateCartUI();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartUI();
}

function updateCartUI() {
    const container = document.getElementById('cart-items');
    const totalEl = document.getElementById('cartTotal');
    container.innerHTML = '';
    
    if(cart.length === 0) container.innerHTML = '<p class="empty-msg">Carrinho vazio</p>';

    let total = 0;
    cart.forEach((item, index) => {
        total += item.price * item.qtd;
        container.innerHTML += `
            <div class="cart-item">
                <div><strong>${item.qtd}x</strong> ${item.name}</div>
                <div>R$ ${(item.price * item.qtd).toFixed(2)} <span class="btn-remove" onclick="removeFromCart(${index})">✖</span></div>
            </div>`;
    });
    
    totalEl.innerText = `R$ ${total.toFixed(2)}`;
    calculateChange();
}

function toggleCashInput() {
    const method = document.getElementById('paymentMethod').value;
    const cashArea = document.getElementById('cashInputArea');
    cashArea.style.display = (method === 'Dinheiro') ? 'block' : 'none';
    if(method !== 'Dinheiro') {
        document.getElementById('amountPaid').value = '';
        document.getElementById('changeValue').innerText = 'R$ 0,00';
    }
}

function calculateChange() {
    const total = cart.reduce((acc, item) => acc + (item.price * item.qtd), 0);
    const paid = parseFloat(document.getElementById('amountPaid').value) || 0;
    const change = paid - total;
    const changeEl = document.getElementById('changeValue');
    
    if(document.getElementById('paymentMethod').value !== 'Dinheiro') return;

    if(change >= 0) {
        changeEl.innerText = `Troco: R$ ${change.toFixed(2)}`;
        changeEl.style.color = '#27ae60';
    } else {
        changeEl.innerText = `Falta: R$ ${Math.abs(change).toFixed(2)}`;
        changeEl.style.color = '#e74c3c';
    }
}

async function finishSale() {
    if(cart.length === 0) return alert("Carrinho vazio!");
    const method = document.getElementById('paymentMethod').value;
    const total = cart.reduce((acc, item) => acc + (item.price * item.qtd), 0);
    
    if(method === 'Dinheiro') {
        const paid = parseFloat(document.getElementById('amountPaid').value) || 0;
        if(paid < total) return alert("Valor pago insuficiente!");
    }

    const res = await fetch(`${API_URL}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cart, paymentMethod: method, total })
    });

    if(res.ok) {
        alert("✅ Venda realizada!");
        cart = [];
        document.getElementById('amountPaid').value = '';
        updateCartUI();
        loadProducts(); 
    } else {
        alert("Erro ao processar venda.");
    }
}

// --- ESTOQUE (CRUD) ---
async function loadStock() {
    const res = await fetch(`${API_URL}/products`);
    const data = await res.json();
    const tbody = document.querySelector('#stockTable tbody');
    tbody.innerHTML = '';
    
    data.forEach(p => {
        tbody.innerHTML += `
            <tr>
                <td>${p.name}</td>
                <td>R$ ${p.price.toFixed(2)}</td>
                <td>${p.stock}</td>
                <td>
                    <button class="btn-action btn-edit" onclick="startEdit(${p.id}, '${p.name}', ${p.price}, ${p.stock})">✏️</button>
                    <button class="btn-action btn-delete" onclick="deleteProduct(${p.id})">🗑️</button>
                </td>
            </tr>`;
    });
}

async function saveProduct() {
    const id = document.getElementById('prodId').value;
    const name = document.getElementById('prodName').value;
    const price = document.getElementById('prodPrice').value;
    const stock = document.getElementById('prodStock').value;

    if(!name || !price || !stock) return alert('Preencha tudo!');
    const body = JSON.stringify({ name, price, stock });
    const headers = { 'Content-Type': 'application/json' };

    if(id) {
        await fetch(`${API_URL}/products/${id}`, { method: 'PUT', headers, body });
        alert("Atualizado!");
    } else {
        await fetch(`${API_URL}/products`, { method: 'POST', headers, body });
        alert("Criado!");
    }
    cancelEdit();
    loadStock();
}

function startEdit(id, name, price, stock) {
    document.getElementById('prodId').value = id;
    document.getElementById('prodName').value = name;
    document.getElementById('prodPrice').value = price;
    document.getElementById('prodStock').value = stock;
    document.getElementById('formTitle').innerText = "Editar Produto";
    document.getElementById('btnSave').innerText = "Atualizar";
    document.getElementById('btnSave').style.background = "#f1c40f";
    document.getElementById('btnCancel').style.display = "block";
}

function cancelEdit() {
    document.getElementById('prodId').value = '';
    document.getElementById('prodName').value = '';
    document.getElementById('prodPrice').value = '';
    document.getElementById('prodStock').value = '';
    document.getElementById('formTitle').innerText = "Cadastrar Produto";
    document.getElementById('btnSave').innerText = "Salvar";
    document.getElementById('btnSave').style.background = "#3498db";
    document.getElementById('btnCancel').style.display = "none";
}

async function deleteProduct(id) {
    if(confirm("Apagar este produto?")) {
        await fetch(`${API_URL}/products/${id}`, { method: 'DELETE' });
        loadStock();
    }
}

// --- RELATÓRIOS (COM FILTRO) ---
async function loadSales() {
    const res = await fetch(`${API_URL}/sales`);
    const allSales = await res.json();
    
    const dateStart = document.getElementById('dateStart').value;
    const dateEnd = document.getElementById('dateEnd').value;
    const tbody = document.querySelector('#salesTable tbody');
    const totalEl = document.getElementById('periodTotal');
    
    tbody.innerHTML = '';
    let totalPeriodo = 0;

    allSales.forEach(s => {
        // Converte data do banco (DD/MM/YYYY) para ISO (YYYY-MM-DD)
        const dbDatePart = s.sale_date.split(',')[0]; 
        const [day, month, year] = dbDatePart.split('/');
        const saleIso = `${year}-${month}-${day}`;

        let show = true;
        if (dateStart && saleIso < dateStart) show = false;
        if (dateEnd && saleIso > dateEnd) show = false;

        if (show) {
            totalPeriodo += s.total_value;
            tbody.innerHTML += `
                <tr>
                    <td>${s.sale_date}</td>
                    <td>${s.items_summary}</td>
                    <td>${s.payment_method}</td>
                    <td>R$ ${s.total_value.toFixed(2)}</td>
                </tr>`;
        }
    });

    totalEl.innerText = `R$ ${totalPeriodo.toFixed(2)}`;
}

function clearFilters() {
    document.getElementById('dateStart').value = '';
    document.getElementById('dateEnd').value = '';
    loadSales();
}

loadProducts();
import { useCallback, useEffect, useState } from "react";

const statuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
const webhookStatuses = statuses.filter((status) => status !== "pending");
const emptyForm = () => ({ customerName: "", email: "", items: [{ name: "", quantity: 1, unitPrice: "" }] });

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || "Something went wrong");
  return result;
}

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function App() {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 8, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pagination.limit) });
      if (status) params.set("status", status);
      if (search.trim()) params.set("q", search.trim());
      const result = await api(`/api/v1/orders?${params}`);
      setOrders(result.data);
      setPagination(result.meta.pagination);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [page, pagination.limit, status, search]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormOpen(true);
  }

  function openEdit(order) {
    setEditing(order);
    setForm({
      customerName: order.customerName,
      email: order.email,
      items: order.items.map((item) => ({ ...item }))
    });
    setFormOpen(true);
  }

  function updateItem(index, field, value) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index
        ? { ...item, [field]: field === "quantity" ? Number(value) : value }
        : item)
    }));
  }

  async function submitOrder(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        customerName: form.customerName,
        email: form.email,
        items: form.items.map((item) => ({
          name: item.name,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice)
        }))
      };
      await api(editing ? `/api/v1/orders/${editing.id}` : "/api/v1/orders", {
        method: editing ? "PATCH" : "POST",
        body: payload
      });
      setNotice(editing ? "Order updated" : "Order created");
      setFormOpen(false);
      setPage(1);
      if (page === 1) await loadOrders();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteOrder(order) {
    if (!window.confirm(`Delete the order for ${order.customerName}?`)) return;
    try {
      await api(`/api/v1/orders/${order.id}`, { method: "DELETE" });
      setNotice("Order deleted");
      await loadOrders();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function simulateWebhook(order, nextStatus) {
    if (!nextStatus) return;
    try {
      await api("/api/v1/webhooks/orders", {
        method: "POST",
        body: { orderId: order.id, event: "order.status_changed", status: nextStatus }
      });
      setNotice(`Webhook simulated: order marked ${nextStatus}`);
      await loadOrders();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  const pageCount = pagination.totalPages;

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Orderly home">
          <span className="brand-mark">o</span>
          <span>orderly<span className="brand-dot">.</span></span>
        </a>
        <div className="topbar-right">
          <a className="docs-link" href="/api-docs" target="_blank" rel="noreferrer">API docs <span>↗</span></a>
          <span className="avatar">S</span>
        </div>
      </header>

      <section className="page-heading">
        <div>
          <div className="eyebrow"><span className="live-dot" /> OPERATIONS OVERVIEW</div>
          <h1>Orders <span className="heading-count">{pagination.total}</span></h1>
          <p>Keep track of what’s moving and what needs attention.</p>
        </div>
        <button className="primary-button" onClick={openCreate}><span className="plus">+</span> New order</button>
      </section>

      <section className="summary-grid" aria-label="Order summary">
        <SummaryCard label="Total orders" value={pagination.total} note="Across all orders" icon="↗" />
        <SummaryCard label="In progress" value={orders.filter((order) => ["confirmed", "processing", "shipped"].includes(order.status)).length} note="On this page" icon="◷" />
        <SummaryCard label="Delivered" value={orders.filter((order) => order.status === "delivered").length} note="On this page" icon="✓" />
        <SummaryCard label="Page value" value={money(orders.reduce((sum, order) => sum + order.total, 0))} note="Current page total" icon="$" />
      </section>

      <section className="orders-panel">
        <div className="panel-heading">
          <div>
            <h2>All orders</h2>
            <p>A clear view of every customer order.</p>
          </div>
          <span className="results-count">{pagination.total} RECORDS</span>
        </div>
        <div className="toolbar">
          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search customer or email" />
            {search && <button className="clear-search" onClick={() => setSearch("")} aria-label="Clear search">×</button>}
          </label>
          <label className="filter-select">
            <span>Status</span>
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              {statuses.map((item) => <option key={item} value={item}>{capitalize(item)}</option>)}
            </select>
          </label>
        </div>

        {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}
        {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}

        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>ORDER</th><th>CUSTOMER</th><th>ITEMS</th><th>DATE</th><th>STATUS</th><th>TOTAL</th><th><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="empty-state" colSpan="7">Loading orders…</td></tr>
              ) : orders.length === 0 ? (
                <tr><td className="empty-state" colSpan="7"><span className="empty-icon">⌕</span><strong>No orders found</strong><span>Try changing your search or filters.</span></td></tr>
              ) : orders.map((order) => (
                <tr key={order.id}>
                  <td><span className="order-id">#{order.id.slice(0, 8).toUpperCase()}</span></td>
                  <td><div className="customer-cell"><span className="customer-avatar">{order.customerName.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><span><strong>{order.customerName}</strong><small>{order.email}</small></span></div></td>
                  <td><span className="items-cell">{order.items.length} {order.items.length === 1 ? "item" : "items"}</span><small className="item-preview">{order.items.map((item) => item.name).join(", ")}</small></td>
                  <td><span className="date-cell">{new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span></td>
                  <td><StatusBadge status={order.status} /></td>
                  <td><strong className="total-cell">{money(order.total)}</strong></td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-button" title="Edit order" aria-label={`Edit order for ${order.customerName}`} onClick={() => openEdit(order)}>✎</button>
                      <button className="icon-button delete-action" title="Delete order" aria-label={`Delete order for ${order.customerName}`} onClick={() => deleteOrder(order)}>⌫</button>
                      <label className="webhook-control" title="Simulate a status webhook">
                        <span className="sr-only">Simulate status webhook</span>
                        <select value="" onChange={(event) => simulateWebhook(order, event.target.value)}>
                          <option value="">↻</option>
                          {webhookStatuses.map((item) => <option key={item} value={item}>{capitalize(item)}</option>)}
                        </select>
                      </label>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="table-footer">
          <span>Showing <strong>{pagination.total ? (page - 1) * pagination.limit + 1 : 0}–{Math.min(page * pagination.limit, pagination.total)}</strong> of <strong>{pagination.total}</strong> orders</span>
          <div className="pagination">
            <button disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>← <span>Previous</span></button>
            <span className="page-number">{page} <span>of</span> {Math.max(pageCount, 1)}</span>
            <button disabled={pageCount === 0 || page >= pageCount || loading} onClick={() => setPage((current) => current + 1)}><span>Next</span> →</button>
          </div>
        </footer>
      </section>
      <div className="page-footnote"><span>●</span> All systems operational <span className="footnote-divider">·</span> <a href="/health" target="_blank" rel="noreferrer">API status</a></div>

      {formOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}>
          <section className="order-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="modal-heading">
              <div><span className="eyebrow">ORDER DETAILS</span><h2 id="modal-title">{editing ? "Update order" : "Create an order"}</h2></div>
              <button className="icon-button modal-close" onClick={() => setFormOpen(false)} aria-label="Close dialog">×</button>
            </div>
            <form onSubmit={submitOrder}>
              <div className="form-grid">
                <label>Customer name<input required minLength="2" maxLength="100" value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} placeholder="e.g. Maya Patel" /></label>
                <label>Email address<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="maya@example.com" /></label>
              </div>
              <div className="items-heading"><h3>Items</h3><button className="text-button" type="button" onClick={() => setForm({ ...form, items: [...form.items, { name: "", quantity: 1, unitPrice: "" }] })}>+ Add item</button></div>
              <div className="form-items">
                {form.items.map((item, index) => (
                  <div className="item-form-row" key={index}>
                    <label className="item-name-field">Product<input required maxLength="120" value={item.name} onChange={(event) => updateItem(index, "name", event.target.value)} placeholder="Product name" /></label>
                    <label>Qty<input required type="number" min="1" max="100000" value={item.quantity} onChange={(event) => updateItem(index, "quantity", event.target.value)} /></label>
                    <label>Unit price<input required type="number" min="0" max="10000000" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(index, "unitPrice", event.target.value)} placeholder="0.00" /></label>
                    <button className="remove-item" type="button" aria-label="Remove item" disabled={form.items.length === 1} onClick={() => setForm({ ...form, items: form.items.filter((_, itemIndex) => itemIndex !== index) })}>×</button>
                  </div>
                ))}
              </div>
              <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setFormOpen(false)}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Create order"}</button></div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function SummaryCard({ label, value, note, icon }) {
  return <article className="summary-card"><div className="summary-card-top"><span>{label}</span><span className="summary-icon">{icon}</span></div><strong>{value}</strong><small>{note}</small></article>;
}

function StatusBadge({ status }) {
  return <span className={`status-badge status-${status}`}><span className="status-dot" />{capitalize(status)}</span>;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default App;

<<<<<<< HEAD
# Order Management

A small, full-stack order management app with a REST API and a React dashboard. Orders are stored in `data/orders.json`, so the project runs locally without a database service.

## Run locally

Requires Node.js 20.19 or later.

```sh
npm install
npm run dev
```

In another terminal, run the React development server:

```sh
npm run dev:client
```

Open the Vite URL printed in the terminal (usually `http://localhost:5173`). The dashboard proxies API requests to the backend on port 3000. You can also build the frontend with `npm run build`; the backend serves that build from port 3000.

Optional environment variables: `PORT` (backend port) and `CLIENT_ORIGIN` (CORS origin; defaults to allowing the local development client).

## API

- `GET /api/v1/orders` — list with `page`, `limit` (maximum 100), `status`, `email`, `q`, `sort`, and `order` filters.
- `POST /api/v1/orders` — create an order.
- `GET /api/v1/orders/:id` — retrieve an order.
- `PUT /api/v1/orders/:id` and `PATCH /api/v1/orders/:id` — update an order.
- `DELETE /api/v1/orders/:id` — delete an order.
- `POST /api/v1/webhooks/orders` — simulate an `order.status_changed` event with `orderId` and `status`.
- `GET /api-docs` — interactive Swagger documentation.
- `GET /health` — health check.

Successful responses use `{ "success": true, "data": ..., "meta": ... }`; errors include a stable code, message, and request ID. Order totals are calculated by the API from item quantities and unit prices.

The JSON file store is intended for this self-contained assignment/demo. For a multi-instance production deployment, replace `lib/orderStore.js` with a transactional database-backed repository.

## Verify

```sh
npm test
npm run build
```
=======
# -Software-Architecture-System-Design
Project File
>>>>>>> beedd425226c1d02346f632952b51aeac64732a8

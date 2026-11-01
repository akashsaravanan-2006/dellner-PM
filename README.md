# Dellner Project Management Portal

Starter application for a small project-management team.

## Stack
- Frontend: React + Vite + plain CSS
- Backend: Node.js + Express
- Database: MySQL
- Authentication: bcryptjs + JWT
- Live team chat: Socket.IO

## Important security note
The three requested starter accounts are created by `backend/src/seed.js` with the temporary password `Dellner@PM`.
They are marked `must_change_password = 1`. Change the temporary password after the first login. Do not deploy with shared passwords; create individual accounts and use HTTPS.

## Requirements
- Node.js 20+
- MySQL 8+

## 1. Create database
Run `database/schema.sql` in MySQL Workbench or the MySQL CLI.

## 2. Configure backend
```bash
cd backend
npm install
```
Copy `.env.example` to `.env`, then set your MySQL username/password and a long random JWT_SECRET.
```bash
npm run seed
npm run dev
```
Backend runs at http://localhost:5000

## 3. Configure frontend
Open another terminal:
```bash
cd frontend
npm install
npm run dev
```
Open the Vite URL shown in the terminal (usually http://localhost:5173).

## Starter accounts
- charles
- abi
- elango

Temporary password for initial setup: `Dellner@PM` (change it after login).

## Project status rules
- Completed: project status is `Completed`
- Withdrawn: project status is `Withdrawn`
- Upcoming: project is not completed/withdrawn and its start date is in the future
- Pending: all other non-completed/non-withdrawn projects

## Scope of this starter
Included: login, dashboard summaries, project CRUD, team member list and account creation (admin role only), leave requests/announcements, notifications, password changes, and Socket.IO team chat.
Production deployment should add HTTPS, rate limiting, audit logs, backups, stronger admin provisioning, and company IT/security review. Use only with your organisation's approval.

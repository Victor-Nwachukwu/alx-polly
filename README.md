# ALX Polly - Secure Polling Application

A comprehensive polling application built with **Next.js**, **Supabase**, and **TypeScript**. ALX Polly enables users to create, manage, and vote on polls with enterprise-grade security, including RBAC, input validation, CSRF protection, and rate limiting.

---

## 🛠️ Tech Stack

- **Frontend:** Next.js (React, TypeScript)
- **Backend:** Supabase (PostgreSQL, Auth, RLS)
- **Security:** Zod (validation), custom middleware, security headers
- **Other:** Node.js, Vercel (optional for deployment)

---

## 🚀 Project Overview

ALX Polly allows authenticated users to create polls, vote securely, and view results. Admins have access to advanced management features. All operations are protected against common web vulnerabilities.

---

## ⚡ Setup & Installation

### 1. **Clone the repository**

```bash
git clone <repository-url>
cd alx-polly
```

### 2. **Install dependencies**

```bash
npm install
```

### 3. **Configure Supabase**

- Create a Supabase project at [supabase.com](https://supabase.com).
- Set up the database tables and RLS policies (see [Database Security](#database-security) below).

### 4. **Environment Variables**

Copy the example file and set your Supabase credentials:

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your Supabase project details:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url        # e.g. https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SECRET_KEY=your_supabase_secret_key      # (if needed for server-side)
NODE_ENV=development
```

> **How to find your Supabase URL and API keys:**  
> Go to [Supabase Dashboard → Project → Settings → API](https://supabase.com/dashboard/project/_/settings/api) and copy the values.

**Troubleshooting:**  
If you see errors like `Your project's URL and API key are required to create a Supabase client!`, double-check that `.env.local` exists and contains the correct values. Restart your dev server after changes.

### 5. **Run the app locally**

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📝 Usage Examples

### **Creating a Poll**

1. Log in or register.
2. Click "Create Poll" in the dashboard.
3. Enter your question and options (2–10).
4. Submit. Your poll appears in your dashboard.

### **Voting on a Poll**

1. Select a poll from the list.
2. Choose an option and click "Vote".
3. Your vote is securely recorded. Duplicate votes are prevented.

### **Admin Panel**

- Only users with the admin role can access `/admin`.
- Admins can view, edit, or delete any poll.

---

## 🧪 Running & Testing

### **Run Locally**

```bash
npm run dev
```

### **Run Tests**

If tests are set up:

```bash
npm test
```

Or use your preferred test runner (e.g., Jest, Vitest).

### **Manual Security Testing**

- Try accessing admin routes as a non-admin.
- Attempt duplicate voting.
- Submit invalid poll/question data.
- Check security headers with:
  ```bash
  curl -I http://localhost:3000
  ```

---

## 🗄️ Database Security

See the [Database Security](#database-security) section for SQL table setup and RLS policies.

---

## 📚 More Info

- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

---

**⚠️ Security is an ongoing process.**  
Regularly update dependencies, monitor logs, and review security policies. Consider automated security testing and monitoring solutions for continuous protection.

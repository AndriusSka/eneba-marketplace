❯ This is a quick setup check. List the files in this repo, then read
private/assignment.pdf and summarise what it asks for in 5 bullets.

Searched for 1 pattern, read 1 file (ctrl+o to expand)

● Setup looks fine. Here's what's in the repo:

Files (not counting .git/):

- README.md
- .gitignore
- .env (I didn't open it)
- private/assignment.pdf
- ai-logs/.gitkeep, an empty placeholder folder

What the assignment asks for (Eneba Intern Assignment 2027, due within 7
days):

- Build a marketplace web app that looks like eneba.com. It needs a Store
  catalog with filters (platform, region, price), sorting and name search. It
  also needs a homepage made of blocks (banner, best sellers, deals) that each
  get their content from the backend, with nothing hardcoded in the frontend.
- Search, product pages and checkout. Search should be available from anywhere
  and handle typos and partial names. Each product page compares offers from
  several sellers. Checkout covers the cart, a simulated or test-mode payment,
  and delivering the digital key.
- Accounts. Users can sign up and sign in. Checkout and order history are only
  for signed-in users. The intended flow is Homepage or Search → Product →
  Cart → Checkout (sign-in) → Payment → Order and key.
- Tech stack. React for the frontend (TypeScript preferred), PHP or Go for the
  backend (REST or GraphQL), and any database. The scope and architecture are
  up to you, but you'll have to justify them. They say a few features done
  thoroughly beat many minimal ones.
- Deliverables (they won't evaluate without all three). You need a GitHub
  link, a public URL on a free hosting tier (e.g. Render or Vercel), and the
  full AI chat history with both prompts and responses as a .md file or a
  link. They encourage using AI, and you must be able to explain your code.

Since the chat log is a required deliverable, it's worth deciding now how
you'll export these sessions into ai-logs/.

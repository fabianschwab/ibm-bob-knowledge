const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let todos = [];
let nextId = 1;

// GET all todos
app.get('/api/todos', (_req, res) => {
  res.json(todos);
});

// GET a single todo
app.get('/api/todos/:id', (req, res) => {
  const todo = todos.find((t) => t.id === parseInt(req.params.id, 10));
  if (!todo) return res.status(404).json({ error: 'Todo not found' });
  res.json(todo);
});

// CREATE a todo
app.post('/api/todos', (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  const todo = { id: nextId++, title, completed: false };
  todos.push(todo);
  res.status(201).json(todo);
});

// UPDATE a todo
app.put('/api/todos/:id', (req, res) => {
  const todo = todos.find((t) => t.id === parseInt(req.params.id, 10));
  if (!todo) return res.status(404).json({ error: 'Todo not found' });
  if (req.body.title !== undefined) todo.title = req.body.title;
  if (req.body.completed !== undefined) todo.completed = Boolean(req.body.completed);
  res.json(todo);
});

// DELETE a todo
app.delete('/api/todos/:id', (req, res) => {
  const index = todos.findIndex((t) => t.id === parseInt(req.params.id, 10));
  if (index === -1) return res.status(404).json({ error: 'Todo not found' });
  const deleted = todos.splice(index, 1)[0];
  res.json(deleted);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

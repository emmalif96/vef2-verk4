const validator = require('validator');

const xss = require('xss');

const { query } = require('./db');

function isEmpty(s) {
  return s == null && !s;
}
/**
 * Hjálparfall sem XSS hreinsar reit í formi eftir heiti
 * @param {string} fieldName Heiti á reit
 * @returns {function} Middleware sem hreinsar reit ef hann finnst
 */

function sanitizeXSS(fieldName) {
  return (req, res, next) => {
    if (!req.body) {
      next();
    }

    const field = req.body[fieldName];

    if (field) {
      req.body[fieldName] = xss(field);
    }

    next();
  };
}


/**
 * Fetches the data from the database and displays them
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getAll(req, res) {
  let data = '';
  const desc = req.query.order === 'desc';
  const order = desc ? 'position desc' : 'position asc';
  const { completed } = req.query;
  if (typeof completed !== 'undefined') {
    if (completed === 'true' || completed === 'false') {
      data = await query(`SELECT * FROM todo WHERE completed = ${completed} ORDER BY ${order}`);
      return res.json(data.rows);
    }
  } else {
    data = await query(`SELECT * FROM todo ORDER BY ${order}`);
    return res.json(data.rows);
  }
  return res.status(404).json({ error: 'Invalid query string' });
}

/**
 * Fetches the data from the database according to the ID that is chosen
 * If there is no data with that ID, an error message will show up
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getById(req, res) {
  const { id } = req.params;
  const data = await query('SELECT * FROM todo');
  const result = data.rows.find(i => i.id === parseInt(id, 10));
  if (result) res.json(result);
  res.status(404).json({ error: 'ID not found' });
}
async function post(req, res) {
  const { title, due, position, completed = false } = req.body;
  const errors = [];

  if (typeof title === 'undefined') {
    errors.push({
      field: 'title',
      error: 'Vantar Titil',
    });
  } else if (typeof title !== 'string' || title.length === 0) {
    errors.push({
      field: 'title',
      error: 'Titill verður að vera strengur með 1 til 128 stafi',
    });
  }

  if (!isEmpty(due)) {
    if (!validator.isISO8601(due)) {
      errors.push({
        field: 'due',
        error: 'Dagsetning verður að vera gild ISO 8601 dagsetning',
      });
    }
  }

  if (!isEmpty(position)) {
    if (position < 0) {
      errors.push({
        field: 'position',
        error: 'Staðsetning verður að vera heiltala stærri eða jafnt og 0',
      });
    }
  }

  if (!isEmpty(completed)) {
    if (typeof completed !== 'boolean') {
      errors.push({
        field: 'completed',
        error: 'Completed verður að vera boolean',
      });
    }
  }

  if (errors.length > 0) {
    return res.status(400).json(errors);
  }

  sanitizeXSS('title');
  sanitizeXSS('due');
  sanitizeXSS('position');
  sanitizeXSS('completed');

  // Ef forritið kemst hingað þá er búið til nýja færslu
  const newItem = [title, due, position, completed];
  const q = `
  INSERT INTO todo
  (title, due, position, completed)
  VALUES 
  ($1, $2, $3, $4)`;

  await query(q, newItem);
  const item = await query('SELECT * FROM todo ORDER BY id DESC LIMIT 1');
  return res.status(201).json(item.rows);
}

/**
 * Changes the data in the database
 * Gives you error message if the new data isn't the correct type
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */

async function patch(req, res) {
  const { id } = req.params;
  const { title, due, position, completed } = req.body;
  const data = await query('SELECT * FROM todo');
  const item = data.rows.find(i => i.id === parseInt(id, 10));
  if (!item) {
    return res.status(404).json({ error: 'Hlutur ekki fundinn' });
  }
  // Ef forritið fer hingað þá er hluturinn til og skoðað hvort gögnin frá notanda séu í lagi

  const errors = [];
  if (!isEmpty(title)) {
    if (typeof title !== 'string' || title.length === 0) {
      errors.push({
        field: 'title',
        error: 'Titill verður að vera strengur með 1-128 stöfum',
      });
    }
  }

  if (!isEmpty(due)) {
    if (!validator.isISO8601(due)) {
      errors.push({
        field: 'due',
        error: 'Dagsetning verður að vera gild ISO 8601 dagsetning',
      });
    }
  }

  if (!isEmpty(position)) {
    if (position < 0) {
      errors.push({
        field: 'position',
        error: 'Staðsetning verður að vera heiltala stærri eða jafnt og 0',
      });
    }
  }

  if (!isEmpty(completed)) {
    if (typeof completed !== 'boolean') {
      errors.push({
        field: 'completed',
        error: 'Completed verður að vera boolean',
      });
    }
  }

  if (errors.length > 0) {
    return res.status(400).json(errors);
  }

  // Ef hingað er komið þá eru gögnin í lagi
  const que = ['UPDATE todo SET'];
  const set = [];

  if (!isEmpty(title)) {
    sanitizeXSS('title');
    item.title = title;
    set.push(`title = '${title}'`);
  }

  if (!isEmpty(due)) {
    sanitizeXSS('due');
    item.due = due;
    set.push(`due = '${due}'`);
  }

  if (!isEmpty(position)) {
    sanitizeXSS('position');
    item.position = position;
    set.push(`position = ${position}`);
  }

  if (!isEmpty(completed)) {
    sanitizeXSS('completed');
    item.completed = completed;
    set.push(`completed = ${completed}`);
  }

  if (set.length === 0) return res.status(200).json(item);

  que.push(set.join(', '));
  que.push(`WHERE id = ${id}`);

  await query(que.join(' '));

  return res.status(200).json(item);
}

/**
 * Removes an item from the database by ID
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function removeItem(req, res) {
  const { id } = req.params;
  const data = await query('SELECT * FROM todo');
  const item = data.rows.find(i => i.id === parseInt(id, 10));

  if (!item) {
    return res.status(404).json({ error: 'Hlutur ekki fundinn ' });
  }
  await query('DELETE FROM todo WHERE id = $1', [id]);
  return res.status(204).json(item);
}


module.exports = {
  /* todo exporta virkni */
  getAll,
  getById,
  post,
  patch,
  removeItem,
};

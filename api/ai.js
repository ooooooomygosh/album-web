import background from './_ai/background.js';
import comment from './_ai/comment.js';
import recommend from './_ai/recommend.js';
import { json } from './_firebase.js';

const handlers = { background, comment, recommend };
export default function handler(req, res) {
  const task = String(req.query.task || '');
  const run = Object.hasOwn(handlers, task) ? handlers[task] : null;
  return run ? run(req, res) : json(res, 404, { error: '接口不存在。' });
}

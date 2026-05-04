const express = require('express');
const asyncHandler = require('../../middlewares/async-handler');
const historyService = require('../../services/history.service');

const router = express.Router();

router.delete(
  '/emails/history/delete',
  asyncHandler(async (req, res) => {
    const result = await historyService.deleteHistory(req.body?.ids || []);
    res.json(result);
  }),
);

module.exports = router;

const express = require('express');
const asyncHandler = require('../../middlewares/async-handler');
const historyService = require('../../services/history.service');

const router = express.Router();

router.get(
  '/emails/history/export',
  asyncHandler(async (req, res) => {
    const ids = String(req.query.ids || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const provider = req.query.provider ? String(req.query.provider).trim() : null;
    const payload = await historyService.exportHistoryArchive({ ids, provider });
    const filenameProvider = provider && provider !== 'all' ? provider : 'all-services';
    const filename = `tempmail-history-${filenameProvider}-${new Date().toISOString().slice(0, 10)}.json`;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(payload, null, 2));
  }),
);

module.exports = router;

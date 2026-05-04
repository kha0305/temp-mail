const express = require('express');
const asyncHandler = require('../../middlewares/async-handler');
const savedEmailService = require('../../services/saved-email.service');

const router = express.Router();

router.delete(
  '/emails/saved/delete',
  asyncHandler(async (req, res) => {
    const result = await savedEmailService.deleteSavedEmails(req.body?.ids || []);
    res.json(result);
  }),
);

module.exports = router;

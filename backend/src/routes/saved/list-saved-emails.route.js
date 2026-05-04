const express = require('express');
const asyncHandler = require('../../middlewares/async-handler');
const savedEmailService = require('../../services/saved-email.service');

const router = express.Router();

router.get(
  '/emails/saved/list',
  asyncHandler(async (req, res) => {
    const savedEmails = await savedEmailService.listSavedEmails();
    res.json(savedEmails);
  }),
);

module.exports = router;

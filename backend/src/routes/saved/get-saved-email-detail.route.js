const express = require('express');
const asyncHandler = require('../../middlewares/async-handler');
const savedEmailService = require('../../services/saved-email.service');

const router = express.Router();

router.get(
  '/emails/saved/:id',
  asyncHandler(async (req, res) => {
    const savedEmail = await savedEmailService.getSavedEmailDetail(req.params.id);
    res.json(savedEmail);
  }),
);

module.exports = router;

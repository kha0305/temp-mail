const express = require('express');
const asyncHandler = require('../../middlewares/async-handler');
const mailboxService = require('../../services/mailbox.service');

const router = express.Router();

router.delete(
  '/emails/:id',
  asyncHandler(async (req, res) => {
    const result = await mailboxService.deleteMailbox(req.params.id);
    res.json(result);
  }),
);

module.exports = router;

const express = require('express');
const asyncHandler = require('../../middlewares/async-handler');
const mailboxService = require('../../services/mailbox.service');

const router = express.Router();

router.post(
  '/emails/:id/extend-time',
  asyncHandler(async (req, res) => {
    const result = await mailboxService.extendMailbox(req.params.id);
    res.json(result);
  }),
);

module.exports = router;

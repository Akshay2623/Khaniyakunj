const { answerAiQuestion } = require('../services/societyAiAssistantService');

async function askSocietyAssistant(req, res) {
  try {
    const question = String(req.body?.question || '').trim();
    if (!question) {
      return res.status(400).json({ success: false, message: 'question is required.', data: null });
    }

    const response = await answerAiQuestion({
      actor: req.user,
      question,
      requestedSocietyId: req.body?.societyId || null,
    });

    return res.status(200).json({
      success: true,
      message: 'Assistant response generated.',
      data: response,
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to process assistant query.', data: null });
  }
}

module.exports = {
  askSocietyAssistant,
};

import axios from 'axios';
import config from '../config/config.js';
import { logger } from '../utils/logger.js';
import { BadRequestError } from '../utils/appErrors.js';

export const createTelegramSender = () => {
  const sentMessages = new Set(); // it will rack unique message sends

  return async (
    chatId,
    message,
    replyToMessageId,
    token = config?.telegramBotToken,
  ) => {
    if (!token) {
      throw new BadRequestError(
        'TELEGRAM_BOT_TOKEN is required either via argument or config.',
      );
    }

    const key = `${chatId}:${message}:${replyToMessageId || ''}`; // thi is for unique key for the api call

    if (sentMessages.has(key)) {
      logger.log(`Message to chat ${chatId} already sent, skipping.`);
      return false;
    }

    sentMessages.add(key); // it will mark this message as sent
    const sendMessageUrl = `${config.telegram.telegram_url}${token}/sendMessage`;

    const payload = {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
    };
    if (replyToMessageId !== undefined && replyToMessageId !== null) {
      payload.reply_to_message_id = replyToMessageId;
    }

    try {
      await axios.post(sendMessageUrl, payload);
      logger.log(`Message sent successfully to chat ${chatId}.`);
      return true; // return true to indicate success
    } catch (error) {
      logger.error(
        'Error sending message to Telegram:',
        error?.data?.description || 'Request failed with status code 429',
      );
      sentMessages.delete(key); // we will remove key on failure to allow retry
      return false; // return false to indicate failure
    }
  };
};

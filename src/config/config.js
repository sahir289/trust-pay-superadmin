import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

// Env file configuration
function config(Env) {
  return {
    env: Env?.NODE_ENV,
    port: Env?.PORT,
    aws: {
      region: Env?.AWS_REGION || 'us-east-1',
      accessKeyId: Env?.ACCESS_KEY,
      secretAccessKey: Env.secretKeyS3,
      cloudWatchLogGroup: Env?.AWS_LOG_GROUP_NAME,
    },
    jwt: {
      jwt_secret: Env?.JWT_SECRET,
      jwt_expires_in: Env?.JWT_EXPIRES_IN || '2h',
      refresh_token_secret: Env?.REFRESH_TOKEN_SECRET,
      refresh_token_expires_in: Env?.REFRESH_TOKEN_EXPIRES_IN || '7d',
      temp_token: Env?.TEMP_TOKEN,
      temp_token_expires: Env?.TEMP_TOKEN_EXPIRES,
    },
    telegram: {
      telegram_url: Env?.TELEGRAM_URL,
    },
    ocr: {
      url: Env?.OCR_URL,
    },
    // reactAppBaseUrl: Env?.REACT_APP_BASE_URL,
    databaseUrl: Env?.DATABASE_URL,
    accessTokenSecretKey: Env?.ACCESS_TOKEN_SECRET_KEY,
    accessTokenExpireTime: 24 * 60 * 60, // in seconds
    reactFrontOrigin: Env?.REACT_FRONT_ORIGIN,
    reactPaymentOrigin: Env?.REACT_PAYMENT_ORIGIN,
    ocrPrivateKey: Env?.OCR_PRIVATE_KEY,
    clientEmail: Env?.CLIENT_EMAIL,
    bucketName: Env?.BUCKET_NAME,
    bucketRegion: Env?.BUCKET_REGION,
    accessKeyS3: Env?.ACCESS_KEY,
    secretKeyS3: Env?.SECRET_ACCESS_KEY,
    telegramRatioAlertsChatIdUpdatedData: Env?.TELEGRAM_RATIO_ALERTS_CHAT_ID_UPDATED_DATA,
    telegramBotToken: Env?.TELEGRAM_BOT_TOKEN,
    telegramAlertsBotToken: Env?.TELEGRAM_ALERTS_BOT_TOKEN, // currently not in use
    telegramRatioAlertsChatId: Env?.TELEGRAM_RATIO_ALERTS_CHAT_ID,
    telegramDashboardChatId: Env?.TELEGRAM_DASHBOARD_CHAT_ID,
    telegramBankAlertChatId: Env?.TELEGRAM_BANK_ALERT_CHAT_ID,
    telegramDuplicateDisputeChatId: Env?.TELEGRAM_DISPUTE_DUPLICATE_CHAT_ID,
    telegramCheckUTRHistoryChatId: Env?.TELEGRAM_CHECK_UTR_HISTORY_CHAT_ID,
    telegramOcrBotToken: Env?.TELEGRAM_OCR_BOT_TOKEN,
    telegramCheckUtrBotToken: Env?.TELEGRAM_CHECK_UTR_BOT_TOKEN,
    ekoPaymentsActivateUrl: Env?.EKO_PAYMENTS_ACTIVATE_URL,
    ekoPaymentsInitiateUrl: Env?.EKO_PAYMENTS_INITIATE_URL,
    ekoPaymentsStatusUrl: Env?.EKO_PAYMENTS_STATUS_URL,
    ekoWalletBalanceEnquiryUrl: Env?.EKO_WALLET_BALANCE_INQUIRY_URL,
    ekoRegisteredMobileNo: Env?.EKO_REGISTERED_MOBILE_NO,
    ekoAccessKey: Env?.EKO_ACCESS_AUTHENTICATOR_KEY,
    ekoServiceCode: Env?.EKO_SERVICE_CODE,
    ekoUserCode: Env?.EKO_USER_CODE,
    ekoInitiatorId: Env?.EKO_INITIATOR_ID,
    ekoDeveloperKey: Env?.EKO_DEVELOPER_KEY,
    ipInfoApiKey: Env?.IP_INFO_API_KEY,
    latitudeBlock: Env?.BLOCK_LAT,
    longitudeBlock: Env?.BLOCK_LONG,
    nodeProductionLogs: Env?.NODE_ENV,
    cashFreeCreateOrderUrl: Env?.CREATE_ORDER_URL,
    key_id: Env?.RAZOR_PAY_ID,
    key_secret: Env?.RAZOR_PAY_SECRET,
    cashFreeClientSecret: Env?.CLIENT_SECRET,
    cashFreeClientId: Env?.CLIENT_ID,
  };
}

export default {
  ...config(process.env),
};

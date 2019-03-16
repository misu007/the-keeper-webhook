const Messenger = require('messenger-node');
let webhook_config = {
  'verify_token':'MY_VERIFY_TOKEN'
};

const Webhook = new Messenger.Webhook(webhook_config);

Webhook.on('messaging_postbacks', (event_type, sender_info, webhook_event) => {
  console.log(event_type, sender_info, webhook_event);
});
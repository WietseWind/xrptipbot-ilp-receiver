# ILP Receiver for [xrptibot.com](https://xrptibot.com)

Sample code. Running at eg. [https://twitter.xrptipbot.com/WietseWind](https://twitter.xrptipbot.com/WietseWind) (ILP Payment pointer: `$twitter.xrptibot.com/WietseWind`)

1. Make sure you are running `moneyd`
2. Make sure you have configured `moneyd` to use XRP on the live net.
3. Install dependencies: `npm install`
4. Run `node index.js`

Sample NGINX reverse proxy config in [nginx.sample.conf](https://github.com/WietseWind/xrptipbot-ilp-receiver/blob/master/nginx.sample.conf)

--- 

Use [https://github.com/WietseWind/coil-stream-donation](https://github.com/WietseWind/coil-stream-donation) if you want to allow Coil.com donations to be streamed to your payment pointer.

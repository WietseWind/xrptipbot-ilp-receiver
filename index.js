#!/usr/bin/env node

const base64url = require('base64url')
const fetch = require('node-fetch')
const makePlugin = require('ilp-plugin')
const { Server } = require('ilp-protocol-stream')
const Koa = require('koa')
const app = new Koa()
const crypto = require('crypto')

async function run () {
  console.log('Connecting to moneyd...')
  const streamPlugin = makePlugin()
  await streamPlugin.connect()

  const streamServer = new Server({
    plugin: streamPlugin,
    serverSecret: crypto.randomBytes(32)
  })

  streamServer.setMaxListeners(10)

  streamServer.on('connection', connection => {
    let thisConnectionTimeout
    let totalDrops = 0
    console.log('+ New connection:', connection.connectionTag)
    connection.on('stream', stream => {
      stream.setReceiveMax(1000000000)
      stream.on('money', amount => {
        clearTimeout(thisConnectionTimeout)
        thisConnectionTimeout = setTimeout(() => {
          totalDrops = Math.max(connection.totalReceived, totalDrops)
          console.log(`# Connection [ ${connection.connectionTag} ] closed`)
          let tagsplit = connection.connectionTag.split('-')
          let network = tagsplit[0] === 'base64url' ? tagsplit[1] : tagsplit[0]
          let username = tagsplit.reverse()[0]
          if (connection.connectionTag.match(/^base64url-/)) {
            username = base64url.decode(username)
          }

          const backendData = {
            totalDrops: totalDrops,
            connectionTag: connection.connectionTag,
            sourceAccount: connection.sourceAccount,
            destinationAccount: connection.destinationAccount,
            sharedSecret: connection.sharedSecret.toString('hex'),
            network: network,
            username: username
          }
          console.log('      > value             :', `${totalDrops} = ${totalDrops/1000000} XRP`)
          console.log('      > network           :', backendData.network)
          console.log('      > username          :', backendData.username)
          console.log('      > connectionTag     :', backendData.connectionTag)
          console.log('      > sourceAccount     :', backendData.sourceAccount)
          console.log('      > destinationAccount:', backendData.destinationAccount)
          // console.log('      > sharedSecret      :', backendData.sharedSecret)
          
          fetch('https://xrptipbot.internal/index.php/ilpdeposit', { method: 'POST', body: JSON.stringify(backendData), headers: { 'Content-Type': 'application/json' } })
            .then(res => res.json())
            .then(json => console.log(json))
            .catch(e => console.error)

          connection.destroy().then(() => { 
            console.log(`  - Connection [ ${connection.connectionTag} ] cleaned up`) 
          }).catch(console.error)
        }, 10 * 1000)
        totalDrops += parseInt(amount)
        console.log(`  » Got packet for ${amount} units @ ${connection.connectionTag} - Sum: ${Math.max(connection.totalReceived, totalDrops)} drops (${Math.max(connection.totalReceived, totalDrops)/1000000} XRP)`)
      })
    })
  })

  await streamServer.listen()

  console.log('Created Receiver...')
  async function handleSPSP (ctx, next) {
    let username = ctx.originalUrl.replace(/^\/+/, '').split('/')[0].trim()
    let subdomains = ctx.host.replace('.xrptipbot.com', '').split('.')
    let network = subdomains.reverse()[0]
    let encoded = false
    if (subdomains.length > 1) {
      username = subdomains.reverse()[0]
    }
    if (username !== '' && !username.match(/^[a-zA-Z0-9_]+$/)) {
      username = base64url(username)
      encoded = true
    }
    if (username !== 'favicon.ico' && network.match(/^twitter$|^reddit$|^discord$/)) {
      console.log(`Request at domain ${ctx.host} with path ${ctx.originalUrl}`)
      console.log(`   » Network: ${network}`)
      console.log(`   » User   : ${username}`)
    }

    if (ctx.get('Accept').indexOf('application/spsp4+json') !== -1) {
      const details = streamServer.generateAddressAndSecret((encoded ? 'base64url-' : '') + network + '-' + username)
      ctx.body = {
        destination_account: details.destinationAccount,
        shared_secret: details.sharedSecret.toString('base64')
      }
      ctx.set('Content-Type', 'application/spsp4+json')
      ctx.set('Access-Control-Allow-Origin', '*')
    } else {
      let endpoint = `: \n    $${network}.xrptipbot.com/${username}`
      ctx.status = 404
      ctx.body = `ILP Deposit Endpoint${endpoint}\n\nPlease visit: https://www.xrptipbot.com/deposit/`;
      // ctx.redirect('https://www.xrptipbot.com/deposit/ilp-coil', 302)
      return next()
    }
  }

  app
    .use(handleSPSP)
    .listen(1337)

  console.log('Listening')
}

run()
  .catch(e => {
    console.error('##ERROR', e)
    process.exit(1)
  })

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { taskName, taskGid, message, type, fileName, userName } = req.body

    if (!taskName || !message) {
      return res.status(400).json({ error: 'taskName and message are required' })
    }

    const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL
    if (!SLACK_WEBHOOK_URL) {
      console.error('[Notify] SLACK_WEBHOOK_URL not configured')
      return res.status(500).json({ error: 'SLACK_WEBHOOK_URL not configured' })
    }

    // Client-specific values come from environment — keeps this endpoint reusable across portals.
    const portalName = process.env.NEXT_PUBLIC_PORTAL_NAME || 'Portal'
    const channel = process.env.SLACK_CHANNEL || '#xtresse-daily'
    const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || ''

    let slackMessage = {
      channel,
      username: `${portalName} Portal`,
      icon_emoji: ':bell:',
      blocks: []
    }

    if (type === 'upload') {
      slackMessage.blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*File uploaded — ${portalName} task*` }
      })
    } else if (type === 'comment') {
      slackMessage.blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*Client comment — ${portalName} task*` }
      })
    }

    slackMessage.blocks.push({
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Task:*\n${taskName}` },
        { type: 'mrkdwn', text: `*From:*\n${userName || 'Client'}` }
      ]
    })

    slackMessage.blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Message:*\n${message}` }
    })

    if (type === 'upload' && fileName) {
      slackMessage.blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*File:* \`${fileName}\`` }
      })
    }

    if (taskGid) {
      const elements = [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View in Asana' },
          url: `https://app.asana.com/0/0/${taskGid}`
        }
      ]
      if (portalUrl) {
        elements.push({
          type: 'button',
          text: { type: 'plain_text', text: `Open in ${portalName} Portal` },
          url: `${portalUrl}?task=${taskGid}`
        })
      }
      slackMessage.blocks.push({ type: 'actions', elements })
    }

    slackMessage.blocks.push({ type: 'divider' })

    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackMessage)
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('[Notify] Slack API error:', text)
      return res.status(response.status).json({ error: 'Failed to send Slack notification', details: text })
    }

    return res.status(200).json({ success: true, message: `Notification sent to ${channel}` })

  } catch (error) {
    console.error('[Notify] Exception:', error.message)
    return res.status(500).json({ error: 'Internal server error', message: error.message })
  }
}

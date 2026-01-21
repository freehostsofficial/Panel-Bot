const { SlashCommandBuilder, EmbedBuilder, version: discordVersion } = require('discord.js');
const os = require('os');

module.exports = {
  name: 'stats',
  description: 'Display comprehensive bot statistics',
  category: 'Info',
  usage: '/info bot stats',
  cooldown: 10,
  devOnly: false,
  requiredRole: false,
  voiceOnly: false,
  nsfwOnly: false,
  toggleOffCmd: false,
  maintenanceCmd: false,

  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Display comprehensive bot statistics'),

  async execute(client, interaction) {
    await interaction.deferReply();

    const uptimeSeconds = process.uptime();
    const formatUptime = (seconds) => {
      const d = Math.floor(seconds / 86400);
      const h = Math.floor((seconds % 86400) / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      return `${d}d ${h}h ${m}m ${s}s`;
    };

    const guilds = client.guilds.cache;
    const members = guilds.reduce((acc, guild) => acc + guild.memberCount, 0);
    const channels = guilds.reduce((acc, guild) => acc + guild.channels.cache.size, 0);

    const memory = process.memoryUsage();
    const memoryUsage = (memory.heapUsed / 1024 / 1024).toFixed(2);
    const totalMemory = (memory.heapTotal / 1024 / 1024).toFixed(2);

    const embed = new EmbedBuilder()
      .setTitle('📊 **Bot Statistics**')
      .setColor(0x5865F2)
      .setThumbnail(client.user.displayAvatarURL({ size: 1024 }))
      .setDescription(`Comprehensive statistics for ${client.user.username}`)
      .addFields(
        {
          name: '📈 **General Stats**',
          value: `**Servers:** ${guilds.size}\n**Users:** ${members.toLocaleString()}\n**Channels:** ${channels}`,
          inline: true
        },
        {
          name: '⚙️ **System Info**',
          value: `**Uptime:** ${formatUptime(uptimeSeconds)}\n**Memory:** ${memoryUsage}MB / ${totalMemory}MB\n**CPU:** ${os.cpus()[0].model.split('@')[0].trim()}`,
          inline: true
        },
        {
          name: '💻 **Technical Data**',
          value: `**Discord.js:** v${discordVersion}\n**Node.js:** ${process.version}\n**Platform:** ${os.platform()} ${os.arch()}`,
          inline: true
        },
        {
          name: '📂 **Command Info**',
          value: `**Commands:** ${client.slashCommands.size}\n**Categories:** ${new Set([...client.slashCommands.values()].map(cmd => cmd.category)).size}`,
          inline: true
        },
        {
          name: '🔗 **Connections**',
          value: `**WebSocket:** ${client.ws.ping}ms\n**API Latency:** Calculating...`,
          inline: true
        },
        {
          name: '📅 **Created**',
          value: `<t:${Math.floor(client.user.createdTimestamp / 1000)}:R>`,
          inline: true
        }
      )
      .setFooter({ 
        text: 'Always improving your server experience',
        iconURL: client.user.displayAvatarURL()
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    
    // Update with actual API latency
    const msg = await interaction.withResponse();
    const apiLatency = msg.createdTimestamp - interaction.createdTimestamp;
    
    embed.data.fields[4].value = `**WebSocket:** ${client.ws.ping}ms\n**API Latency:** ${apiLatency}ms`;
    
    await interaction.editReply({ embeds: [embed] });
  }
};

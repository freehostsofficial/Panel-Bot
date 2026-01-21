const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../../../Functions/database');
const ptero = require('../../../../Functions/pteroService');

module.exports = {
  name: 'add',
  description: 'Synchronize a new Pterodactyl panel gateway.',
  category: 'Panel',
  data: new SlashCommandBuilder()
    .setName('add')
    .setDescription('Synchronize a new Pterodactyl panel gateway.')
    .addStringOption(opt => opt.setName('name').setDescription("Descriptive label (e.g. 'Main Node')").setRequired(true))
    .addStringOption(opt => opt.setName('url').setDescription('Panel URL (e.g. https://panel.example.com)').setRequired(true))
    .addStringOption(opt => opt.setName('apikey').setDescription('User API Key (NOT Admin Key)').setRequired(true)),

  async execute(client, interaction) {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const name = interaction.options.getString('name');
    const url = interaction.options.getString('url').replace(/\/$/, '');
    const apikey = interaction.options.getString('apikey');

    if (!url.startsWith('http')) {
      return interaction.editReply('❌ Endpoint URI must utilize the `http://` or `https://` protocol.');
    }

    const validation = await ptero.validateKey(url, apikey);
    if (!validation.valid) {
      const embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('🔐 Authentication Failure')
        .setDescription('The handshake with the specified Pterodactyl panel failed.')
        .addFields(
          { name: '🚫 Diagnostics', value: `\`\`\`${validation.error}\`\`\`` },
          { name: '🛠️ Verification', value: '• Confirm the endpoint URL is publicly reachable.\n• Re-generate your **User API Key** (Account > API).\n• Ensure the key has read/write permissions.' }
        )
        .setFooter({ text: 'Security Notice: Never share your API key with others.' });

      return interaction.editReply({ embeds: [embed] });
    }

    await db.savePanel(userId, { name, url, apikey });

    const domain = new URL(url).hostname;

    const embed = new EmbedBuilder()
      .setColor('#2ECC71')
      .setTitle('🤝 Connection Synchronized')
      .setDescription(`**${name}** has been successfully integrated into your management registry.`)
      .addFields(
        { name: '🌐 Endpoint', value: `\`${domain}\``, inline: true },
        { name: '👤 Identity', value: `\`${validation.username}\``, inline: true },
        { name: '🔑 Authorization', value: 'User-Level Key', inline: true },
        { name: '📈 Capabilities', value: 'Full server management, file access, and backup control.', inline: false }
      )
      .setFooter({ text: 'Use /panel select to switch management context.' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};

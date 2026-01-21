const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { handleApiError } = require('../../../../Functions/errorHandler');

module.exports = {
  name: 'reinstall',
  description: 'Trigger an environmental reset and file synchronization.',
  category: 'Server',
  data: new SlashCommandBuilder()
    .setName('reinstall')
    .setDescription('Trigger an environmental reset and file synchronization.')
    .addStringOption(opt => opt.setName('id').setDescription('Server ID').setRequired(true).setAutocomplete(true)),

  async autocomplete(interaction) {
    await pteroUtils.serverAutocomplete(interaction);
  },

  async execute(client, interaction) {
    const resolved = await pteroUtils.resolveServer(interaction);
    if (!resolved) {
      return interaction.reply({ content: '❌ Server not found or panel connection failed.', ephemeral: true });
    }

    const { panel, serverId } = resolved;

    const embed = new EmbedBuilder()
      .setColor('#E74C3C')
      .setTitle('🚨 Critical Authorization Required')
      .setDescription(`You are about to initiate a **Destructive Reinstall** for server \`${serverId}\` on **${panel.name}**.`)
      .addFields(
        {
          name: '💾 Data Safety',
          value: '• All files and folders will be purged.\n• All databases will be dropped.\n• Server settings will reset to default.\n• **Operation is non-reversible.**',
          inline: false
        },
        {
          name: '🛡️ Requirement',
          value: 'Ensure you have a recent 📁 **Backup** before proceeding if there is any critical data you wish to keep.',
          inline: false
        }
      )
      .setFooter({ text: `Panel: ${panel.name} • Session expires in 60s` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('confirm_reinstall')
        .setLabel('Authorize Reinstall')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('💣'),
      new ButtonBuilder()
        .setCustomId('cancel_reinstall')
        .setLabel('Abort Mission')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🛡️')
    );

    const msg = await interaction.reply({ embeds: [embed], components: [row], ephemeral: true, fetchReply: true });

    const collector = msg.createMessageComponentCollector({ time: 60000 });

    collector.on('collect', async i => {
      if (i.customId === 'confirm_reinstall') {
        await i.deferUpdate();
        try {
          await ptero.reinstallServer(panel.url, panel.apikey, serverId);

          const successEmbed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('✅ Reinstallation Authorized')
            .setDescription(`The Pterodactyl engine on **${panel.name}** has received the request. Server \`${serverId}\` is now undergoing a fresh deployment.`)
            .addFields({ name: '⏳ Timeline', value: 'Deployment typically completes within 5-10 minutes.' })
            .setTimestamp();

          await interaction.editReply({ embeds: [successEmbed], components: [] });
        } catch (err) {
          const error = handleApiError(err, 'Reinstallation Engine', 'execute destructive purge');
          await interaction.editReply({ embeds: [error], components: [] });
        }
      } else {
        await i.update({ content: '🛡️ **Reinstallation Mission Aborted.** Data remains secured.', embeds: [], components: [] });
      }
      collector.stop();
    });
  }
};

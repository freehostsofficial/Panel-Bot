const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../../Functions/database');
const ptero = require('../../../Functions/pteroService');
  const pteroUtils = require('../../../Functions/pteroUtils');
const { handleApiError } = require('../../../Functions/errorHandler');

module.exports = {
  name: 'remove',
  description: 'Revoke environmental access for a subuser identity.',
  category: 'User',
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Revoke environmental access for a subuser identity.')
    .addStringOption(opt => opt.setName('id').setDescription('Server ID').setRequired(true).setAutocomplete(true))
    .addStringOption(opt => opt.setName('uuid').setDescription('Subuser UUID (Use /user list to find)').setRequired(true)),

  async autocomplete(interaction) {
    await pteroUtils.serverAutocomplete(interaction);
  },

  async execute(client, interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const resolved = await pteroUtils.resolveServer(interaction);
      if (!resolved) {
        return interaction.editReply({ content: '❌ Server not found or panel connection failed.', ephemeral: true });
      }

      const { panel, serverId } = resolved;
      const subuserId = interaction.options.getString('uuid');

      const embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('🚨 Identity Revocation: Authorization Required')
        .setDescription(`You are about to PERMANENTLY revoke access for identity \`${subuserId}\` on instance \`${serverId}\`.`)
        .addFields(
          { name: '⚠️ Risk Factor', value: '• This user will lose all access to the server.\n• All assigned permissions will be purged.\n• **Operation is non-reversible.**', inline: false }
        )
        .setFooter({ text: 'Authorize the revocation to proceed.' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('confirm_user_remove')
          .setLabel('Authorize Revocation')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('💣'),
        new ButtonBuilder()
          .setCustomId('cancel_user_remove')
          .setLabel('Keep Identity')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🛡️')
      );

      const msg = await interaction.editReply({ embeds: [embed], components: [row], fetchReply: true });

      const collector = msg.createMessageComponentCollector({ time: 60000 });

      collector.on('collect', async i => {
        if (i.customId === 'confirm_user_remove') {
          await i.deferUpdate();
          try {
            await ptero.removeSubuser(panel.url, panel.apikey, serverId, subuserId);

            const successEmbed = new EmbedBuilder()
              .setColor('#2ECC71')
              .setTitle('✅ Identity Revoked')
              .setDescription(`The authorization for \`${subuserId}\` has been erased from the instance configuration.`)
              .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed], components: [] });
          } catch (err) {
            const error = handleApiError(err, 'Identity Control', 'execute revocation', { serverId: interaction.options.getString('id') });
            await interaction.editReply({ embeds: [error], components: [] });
          }
        } else {
          await i.update({ content: '🛡️ **Revocation Aborted.** Identity remains ecosystem-integrated.', embeds: [], components: [] });
        }
        collector.stop();
      });
    } catch (err) {
      const error = handleApiError(err, 'User Revocation', 'initiate revocation process');
      await interaction.editReply({ embeds: [error] });
    }
  }
};

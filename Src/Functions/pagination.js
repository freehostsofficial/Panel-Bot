const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
} = require('discord.js');

/**
 * Create a paginated embed interface
 * @param {Interaction} interaction - Discord interaction
 * @param {Array<EmbedBuilder>} embeds - Array of embeds to paginate
 * @param {Object} options - Pagination options
 */
async function createPaginatedEmbed(interaction, embeds, options = {}) {
    const {
        time = 300000, // 5 minutes
        ephemeral = true
    } = options;

    const send = async (data) => {
        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply(data);
        } else {
            return await interaction.reply(data);
        }
    };

    if (!embeds || embeds.length === 0) {
        return send({
            content: '❌ No content to display.',
            ephemeral: true
        });
    }

    if (embeds.length === 1) {
        return send({
            embeds: [embeds[0]],
            ephemeral
        });
    }

    let currentPage = 0;

    const getButtons = (disabled = false) => {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('first')
                .setEmoji('⏮️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(disabled || currentPage === 0),
            new ButtonBuilder()
                .setCustomId('prev')
                .setEmoji('◀️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(disabled || currentPage === 0),
            new ButtonBuilder()
                .setCustomId('page')
                .setLabel(`${currentPage + 1} / ${embeds.length}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId('next')
                .setEmoji('▶️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(disabled || currentPage === embeds.length - 1),
            new ButtonBuilder()
                .setCustomId('last')
                .setEmoji('⏭️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(disabled || currentPage === embeds.length - 1)
        );
    };

    const message = await send({
        embeds: [embeds[currentPage]],
        components: [getButtons()],
        ephemeral,
        fetchReply: true
    });

    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time
    });

    collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) {
            return i.reply({
                content: '❌ These buttons are not for you!',
                ephemeral: true
            });
        }

        switch (i.customId) {
            case 'first':
                currentPage = 0;
                break;
            case 'prev':
                currentPage = Math.max(0, currentPage - 1);
                break;
            case 'next':
                currentPage = Math.min(embeds.length - 1, currentPage + 1);
                break;
            case 'last':
                currentPage = embeds.length - 1;
                break;
        }

        await i.update({
            embeds: [embeds[currentPage]],
            components: [getButtons()]
        });
    });

    collector.on('end', () => {
        message.edit({
            components: [getButtons(true)]
        }).catch(() => { });
    });
}

/**
 * Split an array into chunks for pagination
 * @param {Array} array - Array to chunk
 * @param {number} size - Size of each chunk
 * @returns {Array<Array>} - Array of chunks
 */
function chunkArray(array, size = 10) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

module.exports = {
    createPaginatedEmbed,
    chunkArray
};
'use strict'
const { User } = require('../models')

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return User
      .findAll({
        where: {
          [Sequelize.Op.or]: [
            { email: 'root@example.com' },
            { email: 'user1@example.com' },
            { email: 'user2@example.com' }
          ]
        },
        raw: true
      })
      .then(async users => {
        await queryInterface.bulkInsert('Followships',
          Array.from({ length: 8 }, () => ({
            following_id: users[Math.floor(Math.random() * users.length)].id,
            follower_id: users[Math.floor(Math.random() * users.length)].id,
            created_at: new Date(),
            updated_at: new Date()
          }))
        )
      })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Favorites', {})
  }
}

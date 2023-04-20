const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('community', 'root', 'root', {
  host: 'localhost',
  dialect: 'mysql',
  define: {
    // 设置默认值为0
    defaultValue: 0,
  },
});

// try {
//   sequelize.authenticate();
//   console.log('Connection has been established successfully.');
// } catch (error) {
//   console.error('Unable to connect to the database:', error);
// }




module.exports = { sequelize }
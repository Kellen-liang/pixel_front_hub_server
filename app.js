const express = require('express')
const bodyParser = require("body-parser");
const cors = require("cors");
const { Op } = require("sequelize");
const jwt = require("jsonwebtoken")
const cookieParser = require('cookie-parser')

//创建应用对象
const PORT = 3001
const app = express()

// const corsOptions = {
//   origin: "*"
// }
// app.use(cors(corsOptions));
app.use(express.json())
// content-type：application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));
// content-type：application/json
app.use(bodyParser.json());
app.use(cookieParser());


app.all('*', function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "http://127.0.0.1:3002");
  res.header("Access-Control-Allow-Headers", "Content-Type,Content-Length, Authorization, Accept,X-Requested-With");
  res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header("X-Powered-By", ' 3.2.1')
  next();
});


const { User } = require('./entity/entity.js')


app.post('/api/user/login', async (req, res) => {
  const { username, password } = req.body
  console.log('form ->', username, password);
  const user = await User.findOne({ where: { username: username } })
  if (user === null) return res.status(200).json({ status: 0, msg: '用户不存在', data:'' })
  if (user.password !== password) return res.status(200).json({ status: 0, msg: '密码错误', data: '' })

  console.log(username, password);

  const token = jwt.sign({ id: user.id, username: username }, "jwtkey")
  const { ...other } = user.dataValues
  delete other.password

  res
    .cookie("access_token", token, {
      httpOnly: true,
    })
    .status(200)
    .json({ status: 1, msg: '登录成功', data: other })
})

app.post('/api/user/get', async (req, res)=> {
  console.log('------',req.cookies);
})
app.post('/api/user/register', async (req, res) => {
  console.log('------------');
  console.log(req.body);
  const { username, password, email } = req.body


  const [user, created] = await User.findOrCreate({
    where: {
      [Op.or]: [
        { username: username },
        { email: email },
      ]
    },
    defaults: {
      username: username,
      password: password,
      email: email
    }
  })
  if (!created) return res.status(200).json({ status: 0, msg: '该用户名或者邮箱已被注册' })
  console.log('--user', user);
  console.log('created---', created);

})
// app.get('/', async (req, res) => {

//     // console.log(User === sequelize.models.User); // true
//     const data = await User.findAll();
//     console.log(data)
//     res.send(data.map((item) => item.toJSON()));
//   // 这里是代码
// });

// app.get('/set', async (req, res) => {
//   const { username, password, email } = req.query;
//   await User.create({
//     username,
//     password,
//   })
//   res.send('OK')
// })

//启动一个服务并监听从 3000端口进入的所有连接请求
app.listen(3001, function () {
  console.log('服务器开启成功');
});
const express = require('express')
const bodyParser = require("body-parser");
const cors = require("cors");
const { Op } = require("sequelize");
const bcrypt = require('bcryptjs');
const jwt = require("jsonwebtoken")
const cookieParser = require('cookie-parser')
const multer  = require('multer')
const path = require('path')

//实例对象
const { User } = require('./entity/entity.js')

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

//文件上传
//① 创建存储空间
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads");
  },
  filename: function (req, file, cb) {
    //解决中文乱码问题
    const originalName = file.originalname
    const encodedName = Buffer.from(originalName,'binary').toString()
    cb(null, Date.now() + encodedName);
  },
});
const upload = multer({ storage });
//② 上传文件接口
app.post("/api/upload", upload.single("file"), function (req, res) {
  const file = req.file;
  res.status(200).json({
    filename: file.filename, 
    path: `http://localhost:3001/api/getImageUrl/${file.filename}`
  })
});

//访问文件
app.get('/api/getImageUrl/:filename', (req, res) => {
  const { filename } = req.params
  const imagePath = path.join(__dirname, 'uploads', filename)
  res.sendFile(imagePath)
})

app.post('/api/user/login', async (req, res) => {
  const { username, password } = req.body
  console.log('form ->', username, password);
  const user = await User.findOne({ where: { username: username } })
  if (user === null) return res.status(200).json({ status: 0, errmsg: '用户不存在', data:'' })
  // 密码hash比对
  const isTruePassword = bcrypt.compareSync(password, user.password)
  if (!isTruePassword) return res.status(200).json({ status: 0, errmsg: '密码错误', data: '' })
  
  //token设置
  const token = jwt.sign({ id: user.id, username: username }, "jwtkey")
  const { ...other } = user.dataValues
  delete other.password

  res
    .cookie("access_token", token, {
      httpOnly: true,
    })
    .status(200)
    .json({ status: 1, errmsg: '', data: other })
})

app.post('/api/user/get', async (req, res)=> {
  console.log('------',req.cookies);
})

app.post('/api/user/register', async (req, res) => {
  const { username, password, email } = req.body

  //密码转hash自动加盐
  const salt = bcrypt.genSaltSync(10);
  const hashPassword = bcrypt.hashSync(password, salt);

  const [user, created] = await User.findOrCreate({
    where: {
      [Op.or]: [
        { username: username },
        { email: email },
      ]
    },
    defaults: {
      username: username,
      password: hashPassword,
      email: email
    }
  })
  if (created) {
    return res.status(200).json({ status: 1, errmsg: '', data:'注册成功' })
  } 
  else {
    return res.status(200).json({ status: 0, errmsg: '该用户名或者邮箱已被注册', data:'' })
  }
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
app.listen(PORT, function () {
  console.log('服务器开启成功');
});
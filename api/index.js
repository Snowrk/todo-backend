const express = require("express");
const app = express();
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
app.use(express.json());
app.use(cors());

let db = null;
const dbPath = path.resolve(__dirname, "mydb.db");
const port = 3000;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    /*
    db.run("DROP TABLE IF EXISTS todo;", (err) => {
      if (err) {
        console.error("Error deleting table:", err.message);
      } else {
        console.log("Table deleted successfully.");
      }
    });
    db.run("DROP TABLE IF EXISTS user;", (err) => {
      if (err) {
        console.error("Error deleting table:", err.message);
      } else {
        console.log("Table deleted successfully.");
      }
    });
    */

    db.run(
      `
      CREATE TABLE IF NOT EXISTS todo (
          id TEXT PRIMARY KEY,
          userId INTEGER FORIGEN KEY,
          todo TEXT NOT NULL,
          status TEXT NOT NULL
      );`,
      (err) => {
        if (err) {
          console.error("Error creating table:", err.message);
        } else {
          console.log('Table "todo" created or already exists.');
        }
      }
    );
    db.run(
      `
      CREATE TABLE IF NOT EXISTS user (
          userId INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          password TEXT NOT NULL
      );`,
      (err) => {
        if (err) {
          console.error("Error creating table:", err.message);
        } else {
          console.log('Table "todo" created or already exists.');
        }
      }
    );
    app.listen(port, () => {
      console.log(`Server Started at port ${port}`);
    });
  } catch (e) {
    console.log(e.message);
    process.exit(1);
  }
};

initializeDBAndServer();

const queryAugGen = (request, response, next) => {
  request.aug = request.query;
  //console.log(request.aug)
  //console.log(request.query)
  next();
};

const bodyAugGen = (request, response, next) => {
  request.body.date = request.body.dueDate;
  request.aug = request.body;
  // console.log(request.aug)
  next();
};

const checker = (request, response, next) => {
  const { status } = request.query;

  const statusArr = ["DONE", "PENDING", "IN PROGRESS", "COMPLETED"];

  if (status !== undefined && !statusArr.includes(status)) {
    response.status(400);
    response.send({ err: "Invalid Todo Status" });
  } else {
    next();
  }
};

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send({ err: "Invalid JWT Token" });
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send({ err: "Invalid JWT Token" });
      } else {
        next();
      }
    });
  }
};

app.post("/users/", async (request, response) => {
  try {
    const { name, password, email } = request.body;
    console.log(name, password, email);
    const hashedPassword = await bcrypt.hash(request.body.password, 10);
    console.log(hashedPassword);
    const selectUserQuery = `SELECT * FROM user WHERE email = '${email}'`;
    const dbUser = await db.get(selectUserQuery);
    if (dbUser === undefined) {
      const createUserQuery = `
      INSERT INTO 
        user (name, password, email) 
      VALUES 
        (
          '${name}',
          '${hashedPassword}', 
          '${email}'
        )`;
      const dbResponse = await db.run(createUserQuery);
      const newUserId = dbResponse.lastID;
      const payload = {
        email: email,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ newUserId, jwtToken });
    } else {
      response.status(400);
      response.send({ err: "Email already exists" });
    }
  } catch (e) {
    console.log(e);
  }
});

app.post("/login/", async (request, response) => {
  try {
    const { email, password } = request.body;
    console.log(email, password);
    const selectUserQuery = `SELECT * FROM user WHERE email = '${email}'`;
    const dbUser = await db.get(selectUserQuery);
    if (dbUser === undefined) {
      response.status(400);
      response.send({ err: "Invalid User" });
    } else {
      const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
      if (isPasswordMatched === true) {
        const payload = {
          email: email,
        };
        const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
        response.send({ jwtToken, dbUser });
      } else {
        response.status(400);
        response.send({ err: "Invalid Password" });
      }
    }
  } catch (e) {
    console.log(e);
  }
});

app.get("/profile/:userId", authenticateToken, async (request, response) => {
  try {
    let { userId } = request.params;
    const selectUserQuery = `SELECT * FROM user WHERE userId = '${userId}'`;
    const userDetails = await db.get(selectUserQuery);
    response.send(userDetails);
  } catch (e) {
    console.log(e);
  }
});

app.put("/users/:userId/", bodyAugGen, checker, async (request, response) => {
  try {
    const { userId } = request.params;
    const { name, email } = request.body;
    let updateProfileQuery = `UPDATE user SET name = '${name}', email = '${email}' WHERE userId = '${userId}'`;
    let res = "Profile Updated";
    await db.run(updateProfileQuery);
    response.send(res);
  } catch (e) {
    console.log(e);
  }
});

app.put(
  "/users/:userId/password",
  bodyAugGen,
  checker,
  async (request, response) => {
    try {
      const { userId } = request.params;
      const { password, pass } = request.body;
      const selectUserQuery = `SELECT * FROM user WHERE userId = '${userId}'`;
      const dbUser = await db.get(selectUserQuery);
      const isPasswordMatched = await bcrypt.compare(pass, dbUser.password);
      let res = "";
      if (isPasswordMatched) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const updatePasswordQuery = `UPDATE user SET password = '${hashedPassword}' WHERE userId = '${userId}'`;
        await db.run(updatePasswordQuery);
        res = "Password Changed Successfully";
      } else {
        res = "Incorrect Password";
      }
      response.send({ msg: res });
    } catch (e) {
      console.log(e);
    }
  }
);

app.get("/", async (request, response) => {
  try {
    response.send("hello");
  } catch (e) {
    console.log(e);
  }
});

app.get("/todos/:userId/", queryAugGen, checker, async (request, response) => {
  try {
    const { status = "", search_q = "" } = request.query;
    const { userId } = request.params;
    const filteredTodosQuery = `SELECT id, todo, status FROM todo WHERE status LIKE '%${status}%' AND todo LIKE '%${search_q}%' AND userId=${userId}`;
    const filteredTodos = await db.all(filteredTodosQuery);
    response.send(filteredTodos);
  } catch (e) {
    console.log(e);
  }
});

app.get("/todos/:todoId/", async (request, response) => {
  try {
    const { userId, todoId } = request.params;
    const todoQuery = `SELECT id, todo, status FROM todo WHERE id = ${todoId}`;
    const todo = await db.get(todoQuery);
    response.send(todo);
  } catch (e) {
    console.log(e);
  }
});

app.post("/todos/", bodyAugGen, checker, async (request, response) => {
  try {
    const { id, todo, status, userId } = request.body;
    const uploadTodoQuery = `INSERT INTO todo(id, userId, todo, status) VALUES('${id}', ${userId}, '${todo}', '${status}')`;
    await db.run(uploadTodoQuery);
    response.send(`Todo Successfully Added ${todo}`);
  } catch (e) {
    console.log(e);
  }
});

app.put("/todos/:todoId/", bodyAugGen, checker, async (request, response) => {
  try {
    const { todoId } = request.params;
    let updateTodoQuery = `UPDATE todo SET status = '${request.body.status}' WHERE id = '${todoId}'`;
    let res = "Status Updated";
    await db.run(updateTodoQuery);
    // const logUpdatedTodo = await db.get(
    //   `SELECT * FROM todo WHERE id = ${todoId}`,
    // )
    // console.log(logUpdatedTodo)
    response.send(res);
  } catch (e) {
    console.log(e);
  }
});

app.delete("/todos/:todoId/", async (request, response) => {
  try {
    const { todoId } = request.params;
    const deleteTodoQuery = `DELETE FROM todo WHERE id = '${todoId}'`;
    await db.run(deleteTodoQuery);
    response.send("Todo Deleted");
  } catch (e) {
    console.log(e);
  }
});

db.close((err) => {
  if (err) {
    console.error("Error closing database:", err.message);
  } else {
    console.log("Database closed successfully");
  }
});

module.exports = app;

const express = require("express");
const pool = require("./mysql");

const app = express();
const PORT = 3000;

app.set("json spaces", 2);

// Encode database values safely for HTML output.
function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

app.get("/", async (req, res) => {
    const { category, author, format = "json" } = req.query;

    // Each parameter must contain a single text value.
    for (const value of [category, author, format]) {
        if (value !== undefined && typeof value !== "string") {
            return res.status(400).json({
                error: "Parameters must contain single text values."
            });
        }
    }

    if (format !== "json" && format !== "text") {
        return res.status(400).json({
            error: "Use format=json or format=text."
        });
    }

    let sql = `
        SELECT bookid, title, author, category, price
        FROM books
    `;

    const conditions = [];
    const values = [];

    if (category !== undefined) {
        conditions.push("category = ?");
        values.push(category);
    }

    if (author !== undefined) {
        conditions.push("author = ?");
        values.push(author);
    }

    if (conditions.length > 0) {
        sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY bookid";

    try {
        // Placeholders keep user input separate from SQL commands.
        const [books] = await pool.execute(sql, values);

        if (format === "text") {
            const items = books.map((book) => `
                <li>
                    <strong>${escapeHtml(book.title)}</strong>
                    — ${escapeHtml(book.author)}
                    | ${escapeHtml(book.category)}
                    | $${Number(book.price).toFixed(2)}
                    | Book ID: ${book.bookid}
                </li>
            `).join("");

            return res.type("html").send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <title>Book Search Results</title>
                </head>
                <body>
                    <h1>Book Search Results</h1>
                    <p>${books.length} book(s) found.</p>
                    ${books.length > 0
                        ? `<ul>${items}</ul>`
                        : "<p>No matching books found.</p>"}
                </body>
                </html>
            `);
        }

        return res.json(books);
    } catch (error) {
        console.error("Database query failed:", error.message);

        if (format === "text") {
            return res.status(500).type("html").send(
                "<h1>Database error</h1><p>Unable to retrieve books.</p>"
            );
        }

        return res.status(500).json({
            error: "Unable to retrieve books."
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
import express, { Request, Response } from 'express';
import cors from 'cors';

const app = express();
app.use(cors());

app.get('/', async (req: Request, res: Response) => {
    await new Promise<void>((resolve) => {
        setTimeout(() => {
            resolve();
        }, 2000);
    });

    res.json({ message: 'Hello, World!' });
    return
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
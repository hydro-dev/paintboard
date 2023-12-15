import {
    ConnectionHandler, Context, db, Handler, Logger, PRIV, registerResolver, subscribe, Time,
} from 'hydrooj';

interface PaintboardColl {
    x: number;
    y: number;
    color: number;
    effective: boolean;
    uid: number;
}

const logger = new Logger('paintboard');
const dict = '0123456789abcdefghijklmnopqrstuvwxyz';
const currentBoard: string[] = [];
for (let i = 1; i <= 600; i++) currentBoard.push('.'.repeat(1000));

declare module 'hydrooj' {
    interface Collections {
        paintboard: PaintboardColl;
    }
    interface EventMap {
        'paintboard/paint': (args: { x: number, y: number, color: number }) => void;
    }
}
const coll = db.collection('paintboard');

registerResolver('Query', 'paintboard', 'Paintboard!', () => ({}));
registerResolver('Paintboard', 'board', '[String]', () => currentBoard);
registerResolver('Paintboard', 'paint(x: Int!, y: Int!, color: Int!)', 'String', async (args, ctx) => {
    if (!ctx.user.hasPriv(PRIV.PRIV_USER_PROFILE)) return '请先登录';
    if (args.x < 0 || args.y < 0 || args.x >= 1000 || args.y >= 600) return '坐标超出范围';
    if (args.color > 32) return '无效颜色';
    const timeFilter = { $gt: Time.getObjectID(new Date(Date.now() - 8 * 1000), true) };
    if (await coll.findOne({ _id: timeFilter, uid: ctx.user._id })) return '冷却时间未到';
    await coll.updateMany({ x: args.x, y: args.y }, { $set: { effective: false } });
    await coll.insertOne({ ...args, effective: true, uid: ctx.user._id });
    logger.debug('User %s painted (%d, %d) with color %d', ctx.user.username, args.x, args.y, args.color);
    bus.broadcast('paintboard/paint', args);
    return '';
});

function update(x: number, y: number, color: number) {
    currentBoard[y] = currentBoard[y].substring(0, x) + dict[color] + currentBoard[y].substring(x + 1);
}

class ConnHandler extends ConnectionHandler {
    category = '#paintboard';

    @subscribe('paintboard/paint')
    async onPaint(args) {
        this.send(args);
    }
}

class PaintboardHandler extends Handler {
    get() {
        this.response.template = 'paintboard.html';
    }
}

export async function apply(ctx: Context) {
    ctx.on('paintboard/paint', (args) => update(args.x, args.y, args.color));
    await db.ensureIndexes(
        coll,
        { key: { x: 1, y: 1 }, name: 'pos' },
        { key: { uid: 1 }, name: 'user' },
    );
    const res = await coll.find({ effective: true }).toArray();
    for (const { x, y, color } of res) update(x, y, color);
    logger.success('Loaded board with %d pixels', res.length);
    ctx.Connection('paintboard_conn', '/paintboard/conn', ConnHandler);
    ctx.Route('paintboard', '/paintboard', PaintboardHandler);
}

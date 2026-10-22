// generate unique Id which is used while add new user.
const uuid = (): string => 'xxxxxxxx-xxxx-xxx'.replace(/[x]/g, () => Math.floor(Math.random() * 16).toString(16));

export default uuid;

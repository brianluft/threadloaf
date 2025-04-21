import { ApiServer } from "../../api-server";
import { DataStore } from "../../data-store";
import { createShared } from "./shared";

jest.mock("../../data-store");

describe("ApiServer start", () => {
    let dataStore: jest.Mocked<DataStore>;

    beforeEach(() => {
        jest.clearAllMocks();

        const x = createShared();
        dataStore = x.dataStore;
    });

    test("should start the API server listening on the specified port", () => {
        // Mock the listen method of app
        const listenMock = jest.fn().mockImplementation((port, callback) => {
            // Call the callback to simulate server start
            callback();
            return { on: jest.fn() };
        });

        // Create server with mocked app
        const server = new ApiServer(3456, dataStore);

        // @ts-ignore - replace app.listen with mock
        server.app.listen = listenMock;

        // Spy on console.log
        const consoleLogSpy = jest.spyOn(console, "log");
        consoleLogSpy.mockImplementation(() => {});

        // Call start method
        server.start();

        // Verify server was started on the correct port
        expect(listenMock).toHaveBeenCalledWith(3456, expect.any(Function));
        expect(consoleLogSpy).toHaveBeenCalledWith("API server listening on port 3456");

        // Restore console.log
        consoleLogSpy.mockRestore();
    });
});
